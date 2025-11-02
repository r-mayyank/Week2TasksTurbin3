import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Turbin3Escrow } from "../target/types/turbin3_escrow";
import {ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
// import { UninitializedError } from "@metaplex-foundation/mpl-token-metadata";
import dotenv from "dotenv";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
dotenv.config();

describe(" ", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Turbin3Escrow as Program<Turbin3Escrow>;

  const connection = provider.connection;
  const payer = provider.wallet as anchor.Wallet;

  const mint_a = new anchor.web3.PublicKey("FpSwkQSfEoPjGyaEG7ppJ169Vtf2tJJj6XyM5ALRuCmk");
  if (!process.env.MINT_AUTHORITY_SECRET) {
    throw new Error(
      "Environment variable MINT_AUTHORITY_SECRET is not set. Add it to .env as a JSON array (e.g. [1,2,3,...]) or export it in your shell."
    );
  }
  let secretArray: number[];
  try {
    secretArray = JSON.parse(process.env.MINT_AUTHORITY_SECRET);
  } catch (err) {
    throw new Error(
      `Failed to parse MINT_AUTHORITY_SECRET as JSON: ${(err as Error).message}`
    );
  }
  const mintAuthority = Keypair.fromSecretKey(Uint8Array.from(secretArray));

  const tokenProgram = TOKEN_2022_PROGRAM_ID;
  let maker: Keypair;
  let taker: Keypair;

  let mint_b: PublicKey;

  let maker_ata_a: PublicKey;
  let maker_ata_b: PublicKey;
  let taker_ata_a: PublicKey;
  let taker_ata_b: PublicKey;
  let vault: PublicKey;
  let escrowPDA: PublicKey;
  let escrowBump: number;

  let fee_authority: PublicKey;
  let fee_authority_bump: number;
  let fee_account: PublicKey;

  before("Setup", async() => {

    //e In case of devnet testing we've to do it this way..
    if (!process.env.MAKER_SECRET_KEY) {
      throw new Error(
        "Environment variable MAKER_SECRET_KEY is not set. Add it to .env as a JSON array (the keypair secret) or export it in your shell."
      );
    }
    if (!process.env.TAKER_SECRET_KEY) {
      throw new Error(
        "Environment variable TAKER_SECRET_KEY is not set. Add it to .env as a JSON array (the keypair secret) or export it in your shell."
      );
    }
    let makerSecret: number[];
    let takerSecret: number[];
    try {
      makerSecret = JSON.parse(process.env.MAKER_SECRET_KEY!);
      takerSecret = JSON.parse(process.env.TAKER_SECRET_KEY!);
    } catch (err) {
      throw new Error(
        `Failed to parse MAKER_SECRET_KEY or TAKER_SECRET_KEY as JSON: ${(err as Error).message}`
      );
    }
    maker = Keypair.fromSecretKey(Uint8Array.from(makerSecret));
    taker = Keypair.fromSecretKey(Uint8Array.from(takerSecret));

    console.log("Maker's PublicKey: ",maker.publicKey.toBase58());
    console.log("Taker's PublicKey: ",taker.publicKey.toBase58());


    const seed = new anchor.BN(2);
    [escrowPDA,escrowBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        seed.toArrayLike(Buffer,"le",8),
      ],
      program.programId
    );

    [fee_authority,fee_authority_bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("fee_authority")],
      program.programId
    );

    //e This is the fee account
    fee_account = (await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer, //e This is the one paying the rent..
      mint_a,
      fee_authority,
      true,
      "confirmed",
      undefined,
      tokenProgram
    )).address;

    //Mint-B
    mint_b  = await createMint(
      connection,
      payer.payer, //e Signer/Payer
      payer.publicKey , //e MintAuthority,
      null,
      9,
      undefined,
      undefined, //e ConfirmOptions..
      tokenProgram
    );

    maker_ata_a = (await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer, //e This is the one paying rent...
      mint_a, //e Mint
      maker.publicKey, //e Owner of the ata
      true,//e Owner off -curve?
      "confirmed", //confirmation
      undefined,//e programId
      tokenProgram //e Associated 
    )).address;

    maker_ata_b = (await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer, //e This is the one paying rent...
      mint_b, //e Mint
      maker.publicKey, //e Owner of the ata
      true,//e Owner off -curve?
      "confirmed", //confirmation
      undefined,//e programId
      tokenProgram //e Associated 
    )).address;


    taker_ata_a = (await getOrCreateAssociatedTokenAccount(
      provider.connection, //e connection
      provider.wallet.payer,//e anchor
      mint_a, //e Mint authority
      taker.publicKey, //e Owner
      false,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    )).address

    taker_ata_b = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint_b,
      taker.publicKey, //e Owner/Authority
      false, //e Shpuld the ata be off curve? it should be on curve
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )).address

    vault = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      mint_a,
      escrowPDA,
      true,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )).address;


    //e Minting tokens to maker(mint_a)
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint_a,
      maker_ata_a,
      mintAuthority.publicKey,
      100*10**9, //9 Decimals 
      [mintAuthority],
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );

    // Minting tokens to the taker
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint_b,
      taker_ata_b,
      provider.wallet.publicKey,
      100*10**9,
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );

    console.log("Setup complete: ");
    console.log("mint_b: ", mint_b.toBase58());
    console.log("Vault: ",vault.toBase58());
    console.log("Fee Account: ",fee_account.toBase58());

    const [expectedPDA,_bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        seed.toArrayLike(Buffer,"le",8),
      ],
      program.programId
    );
    console.log("Expected PDA: ",expectedPDA.toBase58());
    console.log("EscrowPDA used: ",escrowPDA.toBase58());
  })


  //Working
  it("Initialize", async() =>{
   const seed = new anchor.BN(2);
   await program.methods
    .initialize(seed, new anchor.BN(100))
    .accountsPartial({
      maker: maker.publicKey,
      mintA: mint_a,
      mintB: mint_b,
      makerAtaA: maker_ata_a,
      makerAtaB: maker_ata_b,
      escrow: escrowPDA,
      vault: vault,
      feeAccount: fee_account,
      feeAuthority: fee_authority,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([maker])
    .rpc();
  })

  //Working
  it("Make", async() => {
     const seed = new anchor.BN(2);
    await program.methods.make(seed, new anchor.BN(50*10**9))
    .accountsPartial({
      maker: maker.publicKey,
      mintA: mint_a,
      mintB: mint_b,
      makerAtaA: maker_ata_a,
      makerAtaB: maker_ata_b,
      escrow: escrowPDA,
      vault: vault,
      feeAccount: fee_account,
      feeAuthority: fee_authority,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).signers([maker]).rpc();
  })

  //Working , commented out for refund to work.
  // it("Take", async() => {
  //    const seed = new anchor.BN(2);
  //   await program.methods.take(seed)
  //   .accountsPartial({
  //     taker: taker.publicKey,
  //     maker: maker.publicKey,
  //     mintA: mint_a,
  //     mintB: mint_b,
  //     makerAtaA: maker_ata_a,
  //     makerAtaB: maker_ata_b,
  //     takerAtaA: taker_ata_a,
  //     takerAtaB: taker_ata_b,
  //     escrow: escrowPDA,
  //     vault: vault,
  //     feeAccount: fee_account,
  //     feeAuthority: fee_authority,
  //     associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //     tokenProgram: TOKEN_2022_PROGRAM_ID,
  //     systemProgram: anchor.web3.SystemProgram.programId,
  //   }).signers([taker]).rpc();
  // });

  it("Refund",async() => {
    const seed = new anchor.BN(2);
    await program.methods.refund(seed).accountsPartial({
      maker: maker.publicKey,
      mintA: mint_a,
      mintB: mint_b,
      makerAtaA: maker_ata_a,
      escrow: escrowPDA,
      vault: vault,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).signers([maker]).rpc();
  })  
})