import contextlib
import dataclasses
from typing import ContextManager, Optional

import torch
from hivemind.utils.logging import get_logger

from petals.client.inference_session import InferenceSession

logger = get_logger(__name__)


@dataclasses.dataclass(frozen=True)
class RemotePastKeyValues:
    hypo_ids: Optional[torch.LongTensor] = None


class RemoteGenerationMixin:
    """
    A class containing all functions for auto-regressive text generation, to be used as a mixin in [`BloomForCausalLM`].
    The class exposes can be used for:
        - *greedy decoding*.
        - *multinomial, top-k and top-p sampling*.
        - *beam-search decoding*

    This class is similar to transformer's [`generation_utils.GenerationMixin`], it can be used instead of it.
    However, it has some differences for remote usage.
    """

    @property
    def active_session(self) -> Optional[InferenceSession]:
        return self.transformer.h.active_session

    def inference_session(self, **kwargs) -> ContextManager[InferenceSession]:
        """
        Returns an inference session for the model's RemoteSequential module.

        :param max_length: Maximal expected length of inference results. Servers use this parameter
                           to calculate the size of attention caches allocated to this client.
        """

        return self.transformer.h.inference_session(**kwargs)

    def use_session(self, session: Optional[InferenceSession]) -> ContextManager[InferenceSession]:
        return self.transformer.h.use_session(session)

    def generate(
        self,
        inputs: Optional[torch.Tensor] = None,
        *args,
        session: Optional[InferenceSession] = None,
        **kwargs
    ):
        if session is not None:
            # If a session specified explicitly, use it
            context_manager = self.use_session(session)
        elif self.active_session is not None:
            # If there's an active session, don't do anything
            context_manager = contextlib.nullcontext()
        else:
            # If there's no active session, create a new one

            max_length = kwargs.get("max_length")
            max_new_tokens = kwargs.get("max_new_tokens")
            assert (max_length is None) != (
                max_new_tokens is None
            ), "You should set `max_length` or `max_new_tokens` (but not both) to reserve server-side attention caches"

            if max_length is not None:
                session_max_length = max_length
            else:
                session_max_length = (inputs.shape[1] if inputs is not None else 0) + max_new_tokens
            context_manager = self.inference_session(max_length=session_max_length)

        with context_manager:
            return super().generate(inputs, *args, **kwargs)

    @staticmethod
    def _reorder_cache(past_key_values: RemotePastKeyValues, beam_idx: torch.LongTensor) -> RemotePastKeyValues:
        return dataclasses.replace(past_key_values, hypo_ids=beam_idx)
