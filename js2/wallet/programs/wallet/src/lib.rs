use anchor_lang::prelude::*;

declare_id!("5hhRuXxQLfAMMXzj3CSVZmn2tays19tWPepNmzmRKUZZ");

#[program]
pub mod wallet {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
