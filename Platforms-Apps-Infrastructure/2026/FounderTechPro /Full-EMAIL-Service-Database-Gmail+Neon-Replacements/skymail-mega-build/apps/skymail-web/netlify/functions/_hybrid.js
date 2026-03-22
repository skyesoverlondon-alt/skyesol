const crypto = require("crypto");

function hybridEncryptWithPublicKeyPem(publicKeyPem, plaintextUtf8){
  if(!publicKeyPem || !String(publicKeyPem).includes("BEGIN PUBLIC KEY")){
    throw new Error("Invalid recipient public key");
  }
  const aesKey = crypto.randomBytes(32); // AES-256
  const iv = crypto.randomBytes(12); // AES-GCM standard IV length

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(String(plaintextUtf8), "utf8")),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  // WebCrypto AES-GCM returns ciphertext with auth tag appended.
  const ciphertextWithTag = Buffer.concat([ciphertext, tag]);

  const encryptedKey = crypto.publicEncrypt(
    {
      key: String(publicKeyPem),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey
  );

  return {
    encrypted_key_b64: encryptedKey.toString("base64"),
    iv_b64: iv.toString("base64"),
    ciphertext_b64: ciphertextWithTag.toString("base64"),
  };
}

module.exports = { hybridEncryptWithPublicKeyPem };
