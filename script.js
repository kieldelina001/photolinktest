// Initialize ImageKit
const imagekit = new ImageKit({
    publicKey: "public_k1qB8gPzcw2eO0d4qfWyAWtyv5M=",
    urlEndpoint: "https://ik.imagekit.io/arqzja2jme"
});

// ... Keep your existing code, replace transmitUpdateToCloud with this:

async function transmitUpdateToCloud(remark, user) {
    const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);
    const aKey = headerMapping['article/item'] || headerMapping['article'];
    const itemCode = String(activeRecord[aKey] || '').trim();

    let finalTimestamp = new Date().toLocaleString('en-US');
    let imageUrl = "";

    if (modalPhotoInput && modalPhotoInput.files.length > 0) {
        const file = modalPhotoInput.files[0];
        showLoading("Uploading to Cloud Storage...");

        // Get Timestamp
        finalTimestamp = await new Promise((resolve) => {
            EXIF.getData(file, function() {
                const exifDateTime = EXIF.getTag(this, "DateTimeOriginal");
                resolve(exifDateTime ? exifDateTime : finalTimestamp);
            });
        });

        // Upload to ImageKit
        try {
            const result = await new Promise((resolve, reject) => {
                imagekit.upload({ file: file, fileName: `Survey_${itemCode}_${Date.now()}.jpg` }, 
                (err, res) => err ? reject(err) : resolve(res));
            });
            imageUrl = result.url;
        } catch (err) {
            alert("Upload failed: " + err.message);
            hideLoading(); return;
        }
    }

    const bodyParams = new URLSearchParams();
    bodyParams.append("article", itemCode);
    bodyParams.append("remarks", remark);
    bodyParams.append("updatedby", user);
    bodyParams.append("timestamp", finalTimestamp);
    if (imageUrl) bodyParams.append("imageURL", imageUrl);

    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: "POST",
            body: bodyParams.toString()
        });
        hideLoading();
        loadInventoryFromGoogleSheets();
    } catch(e) { hideLoading(); }
}
