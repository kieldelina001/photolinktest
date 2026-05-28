// 🔑 Google Sheets Cloud Gateway Architecture
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbysDub-bsa64wNkwypjL4xXjXeLCTyLceOQUiuYHsrqiZXZHte5_6207FEInLP2i7srlw/exec";
const SPREADSHEET_ID = "1ndgXDoLL4LoB3YWnSugfYINW5S8ouN8SlVLZsrkH7A8"; // Fix: Assigned string key instead of folder URL
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=0`;
const BACKUP_FILE_NAME = "real_estate_inventory_backup.csv"; 

const displayHeaders = ["Article", "Description", "Acquisition Date", "Unit Value", "Remarks", "Type", "Photo Link", "UPDATED BY", "LAST UPDATE"];
const targetHeadersLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photo link", "updated by", "last update"];
const popupOrderLowercase = ["article/item", "description", "acquisition date", "unit value", "remarks", "type", "photo link"]; 

let inventoryData = []; 
let rawHeaders = [];       
let headerMapping = {}; 
let activeEditIndex = null; 
let parsedUniqueRemarks = []; 

// 📸 Staging variables tracking image file picker byte data streams
let stagedFileBytes = "";
let stagedFileName = "";

let searchInput, searchButton, exportButton, remarksFilter, typeFilter, tableHeaderRow, tableBody, statusBanner;
let countTotal, countExisting, countNotFound, countVerification;
let editModal, modalFormContainer, modalEditBtn, modalSaveBtn, modalCloseBtn, loadingOverlay, customNameModal;

window.addEventListener('DOMContentLoaded', () => {
    bindDOMElements();
    generateDynamicModals();
    setupSystemEventHandlers();
    loadInventoryFromGoogleSheets();
});

function bindDOMElements() {
    searchInput = document.getElementById('searchInput');
    searchButton = document.getElementById('searchButton');
    exportButton = document.getElementById('exportButton');
    remarksFilter = document.getElementById('remarksFilter');
    typeFilter = document.getElementById('typeFilter');
    tableHeaderRow = document.getElementById('tableHeaderRow');
    tableBody = document.getElementById('tableBody');
    statusBanner = document.getElementById('statusBanner');
    countTotal = document.getElementById('countTotal');
    countExisting = document.getElementById('countExisting');
    countNotFound = document.getElementById('countNotFound');
    countVerification = document.getElementById('countVerification');
    editModal = document.getElementById('editModal');
    modalFormContainer = document.getElementById('modalFormContainer');
    modalEditBtn = document.getElementById('modalEditBtn');
    modalSaveBtn = document.getElementById('modalSaveBtn');
    modalCloseBtn = document.getElementById('modalCloseBtn');
}

function generateDynamicModals() {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dynamicLoadingOverlay';
    loadingOverlay.innerHTML = `
        <div style="text-align: center; color: #ffffff !important; font-family: Arial, sans-serif !important;">
            <div style="width: 60px !important; height: 60px !important; border: 6px solid rgba(255,255,255,0.2) !important; border-radius: 50% !important; border-top-color: #ffffff !important; animation: spin 0.8s linear infinite !important; margin: 0 auto 20px auto !important;"></div>
            <div id="loadingOverlayText" style="font-size: 20px !important; font-weight: bold !important; color: #ffffff !important;">Connecting...</div>
        </div>
    `;
    Object.assign(loadingOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '999999'
    });
    const styleSheet = document.createElement("style");
    styleSheet.innerText = "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    document.head.appendChild(styleSheet);
    document.body.appendChild(loadingOverlay);

    customNameModal = document.createElement('div');
    customNameModal.id = 'customNameModal';
    customNameModal.innerHTML = `
        <div style="background: #ffffff !important; padding: 30px !important; border-radius: 8px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important; width: 90% !important; max-width: 400px !important; box-sizing: border-box !important; text-align: center !important; font-family: Arial, sans-serif !important;">
            <label style="font-size: 18px !important; font-weight: bold !important; color: #333333 !important; display: block !important; margin-bottom: 15px !important;">Enter Your Name to Log This Change:</label>
            <input type="text" id="custom-operator-input" value="Noel Rie N. Deliña" placeholder="Your Name" style="width: 100% !important; padding: 12px !important; font-size: 16px !important; border: 1px solid #ccc !important; border-radius: 4px !important; margin-bottom: 20px !important; box-sizing: border-box !important;" />
            <div style="display: flex !important; gap: 10px !important; justify-content: center !important;">
                <button id="customCancelNameBtn" style="background: #6c757d !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important; font-size: 14px !important;">Cancel</button>
                <button id="customConfirmNameBtn" style="background: #28a745 !important; color: white !important; border: none !important; padding: 10px 20px !important; border-radius: 4px !important; cursor: pointer !important; font-weight: bold !important; font-size: 14px !important;">Confirm & Publish</button>
            </div>
        </div>
    `;
    Object.assign(customNameModal.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'none', justifyContent: 'center',
        alignItems: 'center', zIndex: '99999'
    });
    document.body.appendChild(customNameModal);
}

function showLoading(msg) {
    const textEl = document.getElementById('loadingOverlayText');
    if (textEl) textEl.textContent = msg;
    loadingOverlay.style.setProperty('display', 'flex', 'important');
}

function hideLoading() {
    loadingOverlay.style.setProperty('display', 'none', 'important');
}

async function loadInventoryFromGoogleSheets() {
    if(statusBanner) {
        statusBanner.style.backgroundColor = "#fff3cd";
        statusBanner.style.color = "#856404";
        statusBanner.textContent = "Connecting to Google Sheets Live Datastream...";
    }
    showLoading("Syncing live spreadsheet database...");

    try {
        const response = await fetch(GOOGLE_SHEET_CSV_URL);
        if (!response.ok) throw new Error("Could not connect to online Sheet feed.");
        const rawCsvText = await response.text(); 

        Papa.parse(rawCsvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.data && results.data.length > 0) {
                    rawHeaders = Object.keys(results.data[0]);
                    headerMapping = {};
                    targetHeadersLowercase.forEach(target => {
                        const actualKey = rawHeaders.find(h => h.toLowerCase().trim().includes(target));
                        headerMapping[target] = actualKey || target; 
                    });
                    inventoryData = results.data.map((row, idx) => {
                        row._rowId = idx;
                        return row;
                    });
                    initializeSystemUI();
                } else {
                    showErrorState("Target dataset sheet contains empty cell records.");
                }
                hideLoading();
            }
        });
    } catch (err) {
        hideLoading();
        showErrorState("Offline mode or Cross-Origin Policy Restriction detected.");
        console.error(err);
    }
}

function showErrorState(msg) {
    if(statusBanner) {
        statusBanner.style.backgroundColor = "#f8d7da";
        statusBanner.style.color = "#721c24";
        statusBanner.textContent = "Offline View: " + msg;
    }
}

function initializeSystemUI() {
    if(statusBanner) {
        statusBanner.style.backgroundColor = "#d4edda";
        statusBanner.style.color = "#155724";
        statusBanner.textContent = "✅ Connected to Google Sheets: Live View Active.";
    }
    populateDropdown('remarks', remarksFilter, '-- All Remarks --');
    populateDropdown('type', typeFilter, '-- All Types --');
    calculateStaticDashboardTotals(inventoryData);
    executeSearch();
}

function populateDropdown(type, selectEl, placeholderText) {
    if(!selectEl) return;
    selectEl.innerHTML = `<option value="ALL">${placeholderText}</option>`;
    const sheetKey = headerMapping[type];
    if(!sheetKey) return;
    
    let elements = new Set();
    inventoryData.forEach(row => {
        const val = String(row[sheetKey] || '').trim();
        if(val) elements.add(val);
    });
    
    const sorted = Array.from(elements).sort();
    if(type === 'remarks') parsedUniqueRemarks = sorted;
    
    sorted.forEach(val => {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val;
        selectEl.appendChild(opt);
    });
}

function calculateStaticDashboardTotals(items) {
    if(!countTotal) return;
    countTotal.textContent = items.length;
    
    const rKey = headerMapping['remarks'];
    const tKey = headerMapping['type'];
    let activeCount = 0, missingCount = 0, pendingCount = 0;
    
    items.forEach(row => {
        const remVal = rKey ? String(row[rKey]).toLowerCase().trim() : '';
        const typeVal = tKey ? String(row[tKey]).toLowerCase().trim() : '';
        if(remVal === 'existing' || typeVal === 'existing') activeCount++;
        if(remVal === 'not found') missingCount++;
        if(remVal === 'for verification' || remVal === 'verification') pendingCount++;
    });
    
    if(countExisting) countExisting.textContent = activeCount;
    if(countNotFound) countNotFound.textContent = missingCount;
    if(countVerification) countVerification.textContent = pendingCount;
}

function executeSearch() {
    if(!searchInput || !remarksFilter || !typeFilter) return;

    const term = searchInput.value.toLowerCase().trim();
    const remarkSel = remarksFilter.value;
    const typeSel = typeFilter.value;
    const rKey = headerMapping['remarks'];
    const tKey = headerMapping['type'];
    
    let filtered = inventoryData;
    if(remarkSel !== "ALL" && rKey) filtered = filtered.filter(row => (row[rKey] || '').trim() === remarkSel);
    if(typeSel !== "ALL" && tKey) filtered = filtered.filter(row => (row[tKey] || '').trim() === typeSel);
    if(term) filtered = filtered.filter(row => rawHeaders.some(h => String(row[h]).toLowerCase().includes(term)));
    
    renderTable(filtered);
}

function renderTable(data) {
    if(!tableBody) return;
    tableBody.innerHTML = '';
    if(data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="no-data">No records match filters.</td></tr>`;
        return;
    }
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', row._rowId);
        targetHeadersLowercase.forEach(tKey => {
            const td = document.createElement('td');
            const resolvedKey = headerMapping[tKey];
            td.textContent = resolvedKey ? (row[resolvedKey] || '') : '';
            if (tKey.includes('description')) td.className = 'col-description';
            else if (tKey.includes('remarks')) td.className = 'col-remarks';
            else td.className = 'col-other';
            tr.appendChild(td);
        });
        tr.addEventListener('click', () => openPopUp(row._rowId));
        tableBody.appendChild(tr);
    });
}

function openPopUp(rowId) {
    activeEditIndex = rowId;
    stagedFileBytes = "";
    stagedFileName = "";

    const itemData = inventoryData.find(r => r._rowId === rowId);
    if(!modalFormContainer) return;
    modalFormContainer.innerHTML = '';
    
    const photoFrame = document.getElementById('modalPhotoFrame');
    const imgKey = headerMapping['photo link'];
    const imageUrlStr = imgKey ? String(itemData[imgKey] || '').trim() : '';

    if(imageUrlStr && imageUrlStr.startsWith('http')) {
        photoFrame.innerHTML = `<img src="${imageUrlStr}" alt="Preview" onerror="this.parentElement.innerHTML='<div class=modal-photo-placeholder>Failed to Load Image</div>'">`;
    } else {
        photoFrame.innerHTML = `<div class="modal-photo-placeholder">No Image Available</div>`;
    }

    popupOrderLowercase.forEach(tKey => {
        const realKey = headerMapping[tKey];
        const currentVal = realKey ? (itemData[realKey] || '') : '';
        const idx = targetHeadersLowercase.indexOf(tKey);
        const labelText = displayHeaders[idx];
        
        const wrapper = document.createElement('div');
        wrapper.className = 'modal-field';
        let fieldEl;
        
        // 📸 Dynamic Input generation to match index.html logic layout channels
        if(tKey === 'photo link') {
            fieldEl = document.createElement('input');
            fieldEl.type = 'file';
            fieldEl.accept = "image/*";
            fieldEl.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                stagedFileName = file.name;
                
                const reader = new FileReader();
                reader.onload = function(evt) {
                    stagedFileBytes = evt.target.result.split(',')[1];
                    if (photoFrame) {
                        photoFrame.innerHTML = `<img src="${evt.target.result}" alt="Staged Preview">`;
                    }
                };
                reader.readAsDataURL(file);
            });
        } else if(tKey === 'remarks') {
            fieldEl = document.createElement('select');
            parsedUniqueRemarks.forEach(rem => {
                const opt = document.createElement('option');
                opt.value = rem; opt.textContent = rem;
                if(rem === currentVal) opt.selected = true;
                fieldEl.appendChild(opt);
            });
            if(!currentVal) {
                const fallbackOpt = document.createElement('option');
                fallbackOpt.value = ''; fallbackOpt.textContent = '-- Choose Remark --'; fallbackOpt.selected = true;
                fieldEl.insertBefore(fallbackOpt, fieldEl.firstChild);
            }
        } else if(tKey === 'description') {
            fieldEl = document.createElement('textarea');
            fieldEl.rows = 3; fieldEl.value = currentVal;
        } else {
            fieldEl = document.createElement('input');
            fieldEl.type = 'text'; fieldEl.value = currentVal;
        }
        
        fieldEl.id = 'modal-input-' + tKey.replace(/[^a-zA-SU-Z0-9]/g, '-');
        fieldEl.disabled = true;
        
        const label = document.createElement('label');
        label.textContent = labelText;
        wrapper.appendChild(label); wrapper.appendChild(fieldEl);
        modalFormContainer.appendChild(wrapper);
    });
    
    if(modalEditBtn) modalEditBtn.style.display = 'inline-block';
    if(modalSaveBtn) modalSaveBtn.style.display = 'none';
    if(editModal) editModal.style.display = 'flex';
}

function setupSystemEventHandlers() {
    if(modalEditBtn) {
        modalEditBtn.addEventListener('click', () => {
            const remInput = document.getElementById('modal-input-remarks');
            if(remInput) remInput.disabled = false;
            const photoInput = document.getElementById('modal-input-photo-link');
            if(photoInput) photoInput.disabled = false;

            modalEditBtn.style.display = 'none';
            if(modalSaveBtn) modalSaveBtn.style.display = 'inline-block';
        });
    }

    if(modalSaveBtn) {
        modalSaveBtn.addEventListener('click', () => {
            const remIn = document.getElementById('modal-input-remarks');
            if(!remIn) return;
            const selection = remIn.value;
            if(editModal) editModal.style.display = 'none';
            if(customNameModal) customNameModal.style.display = 'flex';
            
            const confirmBtn = document.getElementById('customConfirmNameBtn');
            if(confirmBtn) {
                confirmBtn.onclick = () => {
                    const opIn = document.getElementById('custom-operator-input');
                    let name = opIn ? opIn.value : '';
                    if(!name || name.trim() === '') name = "Noel Rie N. Deliña";
                    if(customNameModal) customNameModal.style.display = 'none';
                    transmitUpdateToCloud(selection, name.trim());
                };
            }
            
            const cancelBtn = document.getElementById('customCancelNameBtn');
            if(cancelBtn) {
                cancelBtn.onclick = () => {
                    if(customNameModal) customNameModal.style.display = 'none';
                    if(editModal) editModal.style.display = 'flex';
                };
            }
        });
    }

    if(modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => { if(editModal) editModal.style.display = 'none'; });
    }

    if(exportButton) {
        exportButton.addEventListener('click', () => {
            if(inventoryData.length === 0) return;
            const cleanRows = inventoryData.map(r => { const copy = {...r}; delete copy._rowId; return copy; });
            const blob = new Blob([Papa.unparse(cleanRows)], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', BACKUP_FILE_NAME);
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        });
    }

    if(searchButton) searchButton.addEventListener('click', executeSearch);
    if(searchInput) searchInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') executeSearch(); });
    if(remarksFilter) remarksFilter.addEventListener('change', executeSearch);
    if(typeFilter) typeFilter.addEventListener('change', executeSearch);
}

async function transmitUpdateToCloud(remark, user) {
    const activeRecord = inventoryData.find(r => r._rowId === activeEditIndex);
    const aKey = headerMapping['article/item'] || headerMapping['article'];
    const itemCode = String(activeRecord[aKey] || '').trim();

    let finalTimestamp = new Date().toLocaleString('en-US');
    let imageUrl = ""; // This will hold our final ImageKit link

    // 📸 CHECK AND PARSE SELECTED GALLERY IMAGE
    if (modalPhotoInput && modalPhotoInput.files.length > 0) {
        const file = modalPhotoInput.files[0];
        showLoading("Extracting metadata & uploading to cloud...");

        // 1. Get EXIF Timestamp
        finalTimestamp = await new Promise((resolve) => {
            EXIF.getData(file, function() {
                const exifDateTime = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime");
                if (exifDateTime) {
                    const parts = exifDateTime.split(" ");
                    const dateParts = parts[0].split(":");
                    resolve(`${dateParts[1]}/${dateParts[2]}/${dateParts[0]}, ${parts[1]}`);
                } else {
                    resolve(finalTimestamp);
                }
            });
        });

        // 2. Upload to ImageKit (Directly from Browser)
        try {
            // Note: Ensure ImageKit SDK is initialized globally as shown in previous step
            const result = await new Promise((resolve, reject) => {
                imagekit.upload({
                    file: file,
                    fileName: `Survey_${itemCode}_${Date.now()}.jpg`,
                    folder: "/survey-data"
                }, (err, res) => {
                    if (err) reject(err);
                    else resolve(res);
                });
            });
            imageUrl = result.url; // This is the public link to the image
            console.log("Image successfully hosted at:", imageUrl);
        } catch (err) {
            console.error("ImageKit Upload Error:", err);
            alert("Image upload failed. Check your ImageKit settings.");
            hideLoading();
            return;
        }
    }

    // 3. Prepare parameters for Google Apps Script
    const bodyParams = new URLSearchParams();
    bodyParams.append("article", itemCode);
    bodyParams.append("remarks", remark);
    bodyParams.append("updatedby", user);
    bodyParams.append("timestamp", finalTimestamp); 
    
    // Send the URL instead of the massive base64 string
    if (imageUrl) {
        bodyParams.append("imageURL", imageUrl); 
    }

    if(modalPhotoInput) modalPhotoInput.value = ""; 
    if(photoUploadGroup) photoUploadGroup.style.display = 'none';

    showLoading("Saving update to Google Sheets...");
    
    try {
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: bodyParams.toString()
        });
        
        setTimeout(() => { 
            hideLoading();
            loadInventoryFromGoogleSheets(); 
        }, 1500);
    } catch(e) {
        console.error(e);
        hideLoading();
    }
}
