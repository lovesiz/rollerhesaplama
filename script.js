function calculateStrategy() {
    const targetPoints = parseFloat(document.getElementById('targetPoints').value);
    const selectedBoxPrice = parseFloat(document.getElementById('boxPrice').value);
    const multStep = parseInt(document.getElementById('multStep').value);
    const discount = parseFloat(document.getElementById('discount').value) / 100;
    
    // Merkezleme Sabiti
    const centerBoxPrice = 3.45;
    const centerBasePoints = centerBoxPrice * 1000;
    
    const resultBody = document.getElementById('resultBody');

    if (!targetPoints || targetPoints <= 0) {
        alert("Lütfen geçerli bir puan girin!");
        return;
    }

    // İdeal Çarpanı 3.45'e göre bul
    let idealMult = Math.round(targetPoints / (centerBasePoints * 600));
    if (idealMult < 1) idealMult = 1;

    let startMult = idealMult - 10;
    resultBody.innerHTML = "";

    const selectedBasePoints = selectedBoxPrice * 1000;

    for (let i = 0; i < 21; i++) {
        let currentMult = startMult + i;
        
        if (currentMult < 1) continue;

        let investment = (currentMult - 1) * multStep * (1 - discount);
        let boxesNeeded = Math.ceil(targetPoints / (selectedBasePoints * currentMult));
        
        let rowClass = (currentMult === idealMult) ? 'class="target-row"' : '';

        let row = `
            <tr ${rowClass}>
                <td>x${currentMult}</td>
                <td>$${investment.toFixed(2)}</td>
                <td>${boxesNeeded.toLocaleString()} adet</td>
            </tr>
        `;
        resultBody.innerHTML += row;
    }
}

// Sayfa yüklendiğinde otomatik bir kez hesapla
window.onload = calculateStrategy;
