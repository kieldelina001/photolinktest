// 🔑 Initialize ImageKit with your Public Key
const imagekit = new ImageKit({
    publicKey: "public_7P+PlDIEmq6HwED2+NzrdS/VA4s=",
    urlEndpoint: "https://ik.imagekit.io/arqzja2jme"
});

// ... [Keep all your existing variables: GOOGLE_APPS_SCRIPT_URL, inventoryData, etc.] ...

// Update your transmitUpdateToCloud function to use ImageKit
async function transmitUpdateToCloud(remark, user) {
    const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);
    const aKey = headerMapping['article/item'] || headerMapping['article'];
    const itemCode = String(activeRecord[aKey] || '').trim();

    let finalTimestamp = new Date().toLocaleString('en-US');
    let imageUrl = "";

    // UPLOAD TO IMAGEKIT
    if (modalPhotoInput && modalPhotoInput.files.length > 0) {
        const file = modalPhotoInput.files[0];
        showLoading("Uploading photo to ImageKit...");

        try {
            const result = await new Promise((resolve, reject) => {
                imagekit.upload({
                    file: file,
                    fileName: `Survey_${itemCode}_${Date.now()}.jpg`
                }, (err, res) => err ? reject(err) : resolve(res));
            });
            imageUrl = result.url;
        } catch (err) {
            alert("Image upload failed: " + err.message);
            hideLoading(); return;
        }
    }

    // SEND TO GOOGLE SHEETS
    const bodyParams = new URLSearchParams();
    bodyParams.append("article", itemCode);
    bodyParams.append("remarks", remark);
    bodyParams.append("updatedby", user);
    bodyParams.append("timestamp", finalTimestamp);
    if (imageUrl) bodyParams.append("imageURL", imageUrl);

    showLoading("Saving update to Google Sheets...");
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: "POST",
            body: bodyParams.toString()
        });
        hideLoading();
        loadInventoryFromGoogleSheets();
    } catch(e) { hideLoading(); console.error(e); }
}

// ... [Keep the rest of your existing functions below] ...
