/*
  Client-side crypto utilities:
  - RSA-OAEP recipient keys
  - AES-GCM hybrid encryption for message payload
  - Passphrase-based wrapping (PBKDF2 + AES-GCM) for storing private key
*/
const CryptoVault = (() => {
  const te = new TextEncoder();
  const td = new TextDecoder();

  function bufToB64(buf){
    const bytes = new Uint8Array(buf);
    let bin = "";
    for(let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToBuf(b64){
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  function strToBuf(s){ return te.encode(s).buffer; }
  function bufToStr(buf){ return td.decode(buf); }

  function pemWrap(label, b64){
    const lines = b64.match(/.{1,64}/g) || [];
    return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
  }
  function pemUnwrap(pem){
    return pem.replace(/-----BEGIN [^-]+-----/g,"")
      .replace(/-----END [^-]+-----/g,"")
      .replace(/\s+/g,"");
  }

  async function deriveAesKeyFromPassphrase(passphrase, saltB64, iterations=150000){
    const salt = saltB64 ? new Uint8Array(b64ToBuf(saltB64)) : crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey("raw", te.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const aesKey = await crypto.subtle.deriveKey(
      { name:"PBKDF2", salt, iterations, hash:"SHA-256" },
      baseKey,
      { name:"AES-GCM", length:256 },
      false,
      ["encrypt","decrypt"]
    );
    return { aesKey, saltB64: bufToB64(salt.buffer), iterations };
  }

  async function aesGcmEncrypt(aesKey, plaintextBuf){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, aesKey, plaintextBuf);
    return { ivB64: bufToB64(iv.buffer), ctB64: bufToB64(ct) };
  }

  async function aesGcmDecrypt(aesKey, ivB64, ctB64){
    const iv = new Uint8Array(b64ToBuf(ivB64));
    const ct = b64ToBuf(ctB64);
    const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, aesKey, ct);
    return pt;
  }

  async function generateRecipientRsaKeypair(){
    const keypair = await crypto.subtle.generateKey(
      { name:"RSA-OAEP", modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:"SHA-256" },
      true,
      ["encrypt","decrypt"]
    );
    const spki = await crypto.subtle.exportKey("spki", keypair.publicKey);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keypair.privateKey);
    const pubPem = pemWrap("PUBLIC KEY", bufToB64(spki));
    const privPem = pemWrap("PRIVATE KEY", bufToB64(pkcs8));
    return { publicKey: keypair.publicKey, privateKey: keypair.privateKey, publicKeyPem: pubPem, privateKeyPem: privPem };
  }

  async function importRsaPublicKeyFromPem(pubPem){
    const b64 = pemUnwrap(pubPem);
    const spki = b64ToBuf(b64);
    return crypto.subtle.importKey("spki", spki, { name:"RSA-OAEP", hash:"SHA-256" }, true, ["encrypt"]);
  }
  async function importRsaPrivateKeyFromPem(privPem){
    const b64 = pemUnwrap(privPem);
    const pkcs8 = b64ToBuf(b64);
    return crypto.subtle.importKey("pkcs8", pkcs8, { name:"RSA-OAEP", hash:"SHA-256" }, true, ["decrypt"]);
  }

  async function hybridEncryptForRecipient(publicKeyPem, payloadObj){
    const pubKey = await importRsaPublicKeyFromPem(publicKeyPem);
    const aesKey = await crypto.subtle.generateKey({ name:"AES-GCM", length:256 }, true, ["encrypt","decrypt"]);
    const rawAes = await crypto.subtle.exportKey("raw", aesKey);
    const encKey = await crypto.subtle.encrypt({ name:"RSA-OAEP" }, pubKey, rawAes);

    const plaintext = JSON.stringify(payloadObj);
    const { ivB64, ctB64 } = await aesGcmEncrypt(aesKey, strToBuf(plaintext));

    return {
      encrypted_key_b64: bufToB64(encKey),
      iv_b64: ivB64,
      ciphertext_b64: ctB64
    };
  }

  async function hybridDecryptWithPrivateKey(privateKey, encKeyB64, ivB64, ctB64){
    const encKey = b64ToBuf(encKeyB64);
    const rawAes = await crypto.subtle.decrypt({ name:"RSA-OAEP" }, privateKey, encKey);
    const aesKey = await crypto.subtle.importKey("raw", rawAes, { name:"AES-GCM" }, false, ["decrypt"]);
    const ptBuf = await aesGcmDecrypt(aesKey, ivB64, ctB64);
    const plaintext = bufToStr(ptBuf);
    return JSON.parse(plaintext);
  }

  async function wrapPrivateKeyWithPassphrase(privateKeyPem, passphrase){
    const { aesKey, saltB64, iterations } = await deriveAesKeyFromPassphrase(passphrase, null, 150000);
    const { ivB64, ctB64 } = await aesGcmEncrypt(aesKey, strToBuf(privateKeyPem));
    return JSON.stringify({ saltB64, iterations, ivB64, ctB64 });
  }

  async function unwrapPrivateKeyWithPassphrase(vaultWrapJson, passphrase){
    const wrap = JSON.parse(vaultWrapJson);
    const { aesKey } = await deriveAesKeyFromPassphrase(passphrase, wrap.saltB64, wrap.iterations);
    const ptBuf = await aesGcmDecrypt(aesKey, wrap.ivB64, wrap.ctB64);
    const privPem = bufToStr(ptBuf);
    const privateKey = await importRsaPrivateKeyFromPem(privPem);
    return { privateKey, privateKeyPem: privPem };
  }

  // Admin recovery: encrypt the raw private key PEM for admin using a baked-in admin public key (hybrid RSA+AES).
  async function adminEncryptPrivateKey(adminPublicKeyPem, privateKeyPem){
    const pubKey = await importRsaPublicKeyFromPem(adminPublicKeyPem);
    const aesKey = await crypto.subtle.generateKey({ name:"AES-GCM", length:256 }, true, ["encrypt","decrypt"]);
    const rawAes = await crypto.subtle.exportKey("raw", aesKey);
    const encKey = await crypto.subtle.encrypt({ name:"RSA-OAEP" }, pubKey, rawAes);
    const { ivB64, ctB64 } = await aesGcmEncrypt(aesKey, strToBuf(privateKeyPem));
    return JSON.stringify({ encrypted_key_b64: bufToB64(encKey), iv_b64: ivB64, ciphertext_b64: ctB64 });
  }

  return {
    bufToB64, b64ToBuf,
    generateRecipientRsaKeypair,
    hybridEncryptForRecipient,
    hybridDecryptWithPrivateKey,
    wrapPrivateKeyWithPassphrase,
    unwrapPrivateKeyWithPassphrase,
    adminEncryptPrivateKey
  };
})();


async function encryptFileForRecipient(publicKeyPem, file){
  const pubKey = await importRsaPublicKeyFromPem(publicKeyPem);
  const aesKey = await crypto.subtle.generateKey({ name:"AES-GCM", length:256 }, true, ["encrypt","decrypt"]);
  const rawAes = await crypto.subtle.exportKey("raw", aesKey);
  const encKey = await crypto.subtle.encrypt({ name:"RSA-OAEP" }, pubKey, rawAes);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { ivB64, ctB64 } = await aesGcmEncrypt(aesKey, bytes.buffer);

  return {
    filename: file.name || "attachment",
    mime_type: file.type || "application/octet-stream",
    size_bytes: bytes.byteLength,
    encrypted_key_b64: bufToB64(encKey),
    iv_b64: ivB64,
    ciphertext_b64: ctB64
  };
}

async function decryptAttachmentWithPrivateKey(privateKey, encrypted_key_b64, iv_b64, ciphertext_b64){
  const encKey = b64ToBuf(encrypted_key_b64);
  const rawAes = await crypto.subtle.decrypt({ name:"RSA-OAEP" }, privateKey, encKey);
  const aesKey = await crypto.subtle.importKey("raw", rawAes, { name:"AES-GCM" }, false, ["decrypt"]);
  const ptBuf = await aesGcmDecrypt(aesKey, iv_b64, ciphertext_b64);
  return ptBuf;
}

CryptoVault.encryptFileForRecipient = encryptFileForRecipient;
CryptoVault.decryptAttachmentWithPrivateKey = decryptAttachmentWithPrivateKey;
