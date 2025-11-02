import { createSolanaClient, generateKeyPairSigner, getExplorerLink, getSignatureFromTransaction, signTransactionMessageWithSigners } from "gill";
import { loadKeypairSignerFromFile } from "gill/node";
import { buildCreateTokenTransaction, buildMintTokensTransaction, TOKEN_2022_PROGRAM_ADDRESS } from "gill/programs";

const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: "devnet",

});

const signer = await loadKeypairSignerFromFile();

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const mint = await generateKeyPairSigner();

const tx = await buildCreateTokenTransaction({                                  
    feePayer: signer,
    version: "legacy",
    decimals: 0,
    metadata: {
        isMutable: true,
        name: "Shiny Venasaur",
        symbol: "VENASAUR",
        uri: "https://github.com/r-mayyank/Week2TasksTurbin3/blob/main/Mint/metadata.json",
    },
    mint,
    latestBlockhash,
})

const mintTokenTx = await buildMintTokensTransaction({
    feePayer: signer,
    version: "legacy",
    latestBlockhash,
    amount: 100,
    destination: signer.address,
    mint: mint,
    mintAuthority: signer,
})

const signature = await signTransactionMessageWithSigners(tx);
const mintSignature = await signTransactionMessageWithSigners(mintTokenTx);

console.log("Transaction signature:", getExplorerLink({
    cluster: "devnet",
    transaction: getSignatureFromTransaction(signature)
    })
);
console.log("Mint Transaction signature:", getExplorerLink({
    cluster: "devnet",
    transaction: getSignatureFromTransaction(mintSignature)
    })
);

await sendAndConfirmTransaction(signature);
await sendAndConfirmTransaction(mintSignature);