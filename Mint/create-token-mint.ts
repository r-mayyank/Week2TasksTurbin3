import { createSolanaClient, generateKeyPairSigner, getExplorerLink, getSignatureFromTransaction, signTransactionMessageWithSigners } from "gill";
import { loadKeypairSignerFromFile } from "gill/node";
import { buildCreateTokenTransaction } from "gill/programs";

const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: "devnet",

});

const signer = await loadKeypairSignerFromFile();

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const mint = await generateKeyPairSigner();

const tx = await buildCreateTokenTransaction({                                  
    feePayer: signer,
    version: "legacy",
    metadata: {
        isMutable: true,
        name: "Shiny Venasaur",
        symbol: "VENASAUR",
        uri: "https://www.arweave.net/your-token-metadata-uri",
    },
    mint,
    latestBlockhash
})

const signature = await signTransactionMessageWithSigners(tx);
console.log("Transaction signature:", getExplorerLink({
    cluster: "devnet",
    transaction: getSignatureFromTransaction(signature)
    })
);

await sendAndConfirmTransaction(signature);