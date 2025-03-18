use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    sysvar::{rent::Rent, Sysvar},
};
use arrayref::{array_ref, array_refs, array_mut_ref, mut_array_refs};

entrypoint!(process_instruction);

#[derive(Clone, Debug, Default, PartialEq)]
pub struct UserAccount {
    pub is_initialized: bool,
    pub credits: u64,
}

impl Sealed for UserAccount {}

impl IsInitialized for UserAccount {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for UserAccount {
    const LEN: usize = 9;
    
    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, 9];
        let (is_initialized_dst, credits_dst) = mut_array_refs![dst, 1, 8];
        is_initialized_dst[0] = self.is_initialized as u8;
        *credits_dst = self.credits.to_le_bytes();
    }
    
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, 9];
        let (is_initialized_src, credits_src) = array_refs![src, 1, 8];
        let is_initialized = is_initialized_src[0] != 0;
        let credits = u64::from_le_bytes(*credits_src);
        Ok(UserAccount {
            is_initialized,
            credits,
        })
    }
}

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let user_account = next_account_info(accounts_iter)?;
    let token_account = next_account_info(accounts_iter)?;
    
    // Verify the token transfer
    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }
    
    let token_amount = instruction_data[0] as u64;
    if token_amount == 0 {
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // Convert tokens to AI credits
    let credits = token_amount; // Example conversion rate
    
    // Update user's credits
    let mut user_data = UserAccount::unpack_unchecked(&user_account.data.borrow())?;
    if !user_data.is_initialized {
        user_data.is_initialized = true;
    }
    user_data.credits += credits;
    UserAccount::pack(user_data, &mut user_account.data.borrow_mut())?;
    
    msg!("User {} received {} credits", user_account.key, credits);
    Ok(())
}