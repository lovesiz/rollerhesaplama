/* calculator.js
   - parseData(): textarea'dan coin + toplam güçleri ayrıştırır
   - calculateRewards(): kullanıcı gücüne göre lig tespit eder ve o ligdeki coin ödülü ile hesaplama yapar
   - fetchPrices(): CoinGecko'dan anlık fiyatları çeker
   - showUsdTable(): her coin için USD karşılığını gösterir
*/

const LEAGUES = [
  { name: "Bronze I",   min: 0,       max: 5 },
  { name: "Bronze II",  min: 5,       max: 30 },
  { name: "Bronze III", min: 30,      max: 100 },
  { name: "Silver I",   min: 100,     max: 200 },
  { name: "Silver II",  min: 200,     max: 500 },
  { name: "Silver III", min: 500,     max: 1000 },
  { name: "Gold I",     min: 1000,    max: 2000 },
  { name: "Gold II",    min: 2000,    max: 5000 },
  { name: "Gold III",   min: 5000,    max: 15000 },
  { name: "Platinum I", min: 15000,   max: 50000 },
  { name: "Platinum II",min: 50000,   max: 100000 },
  { name: "Platinum III",min:100000,  max: 200000 },
  { name: "Diamond I",  min: 200000,  max: 400000 },
  { name: "Diamond II", min: 400000,  max: 1000000 },
  { name: "Diamond III",min: 1000000, max: Infinity }
];

// coinsData: [{ coin: "RLT", value: 2211000 }, ...]
let coinsData = [];
let rewardsByCoin = {};  // <- kullanıcı ödüllerini tutacak

function extractCoinFrom(prevLine) {
  if (!prevLine) return "UNKNOWN";
  const parts = prevLine.trim().split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const token = parts[i].toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (token) return token;
  }
  return "UNKNOWN";
}

function parseData() {
  const raw = document.getElementById("inputData").value || "";
  let lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  coinsData = [];
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  // Ortak ekleme fonksiyonu: ZH için mevcut ölçek 1_000_000 aynen korunur.
  // EH için 1_000 veriyoruz (ZH, EH'in 1000 katıdır → oran korunur).
  const pushCoin = (coin, num, unitLetter) => {
    const unit = (unitLetter || "Z").toUpperCase(); // Z veya E
    const factor = unit === "Z" ? 1_000_000 : 1_000; // ZH: dokunma, EH: ek
    coinsData.push({ coin, value: num * factor });
  };

  // 1) Tek satır halinde verilmişse (ör: "RLT 407.142 Eh/s XRP 179.792 Eh/s ...")
  //    Coin + sayı + (E|Z)h/s kalıplarını yakala.
  if (lines.length === 1) {
    const regex = /([A-Za-z0-9]+)\s+([\d.,]+)\s*([ZE])h\/s/gi;
    let m;
    while ((m = regex.exec(lines[0])) !== null) {
      const coin = m[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
      let numStr = (m[2] || "").replace(",", ".");
      const num = parseFloat(numStr);
      const unitLetter = (m[3] || "Z").toUpperCase();
      if (coin && !isNaN(num)) {
        pushCoin(coin, num, unitLetter);
      }
    }
  } else {
    // 2) Çok satırlı format: "coin" satırının hemen altındaki değer satırı (Zh/Eh)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Hem Zh/s hem Eh/s kabul et
      if (/(Zh|Eh)\/s/i.test(line)) {
        // Sayıyı çek
        let numStr = line.replace(/(Zh|Eh)\/s/i, "").trim();
        numStr = numStr.replace(",", ".");
        const num = parseFloat(numStr);
        if (isNaN(num)) continue;

        // Üstteki coin satırını bul (gereksiz/başlık satırlarını atla)
        let prev = lines[i - 1] || "";
        let j = i - 1;
        while (j >= 0 && (/^[^A-Za-z0-9]*$/.test(prev) || /crypto/i.test(prev))) {
          j--;
          prev = lines[j] || "";
        }
        const coin = extractCoinFrom(prev);

        // Birim harfini (Z/E) yakala
        const unitMatch = line.match(/([ZE])h\/s/i);
        const unitLetter = unitMatch ? unitMatch[1].toUpperCase() : "Z";

        pushCoin(coin, num, unitLetter);
      }
    }
  }

  if (coinsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Ayrıştırılacak veri bulunamadı.</td></tr>`;
    return;
  }

  // Ön izleme tablosu
  coinsData.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.coin}</td>
      <td>${c.value.toLocaleString()}</td>
      <td>—</td>
      <td>-</td>
      <td>-</td>
    `;
    tbody.appendChild(tr);
  });
}


function findLeague(userPower) {
  if (isNaN(userPower)) return null;
  return LEAGUES.find(l => userPower >= l.min && userPower < l.max) || null;
}

function getBlockReward(leagueName, coin) {
  if (typeof BLOCK_REWARDS_BY_LEAGUE === "undefined") return null;
  const leagueObj = BLOCK_REWARDS_BY_LEAGUE[leagueName];
  if (!leagueObj) return null;
  return (leagueObj[coin] !== undefined) ? leagueObj[coin] : null;
}

async function calculateRewards() {
  const userPowerRaw = (document.getElementById("userPower").value || "").trim().replace(",", ".");
  const userPower = parseFloat(userPowerRaw);

  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  if (!coinsData || coinsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4">Önce tabloya dönüştür.</td></tr>`;
    return;
  }

  if (isNaN(userPower) || userPower <= 0) {
    alert("Geçerli bir 'Kendi Gücün' girin.");
    coinsData.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${c.coin}</td><td>${c.value.toLocaleString()}</td><td>—</td><td>-</td><td>-</td>`;
      tbody.appendChild(tr);
    });
    return;
  }

  const league = findLeague(userPower);
  const leagueRow = document.createElement("tr");
  leagueRow.classList.add("league-row");
  leagueRow.innerHTML = `<td colspan="5">Senin Ligin: ${league ? league.name : "Bulunamadı"}</td>`;
  tbody.appendChild(leagueRow);

  rewardsByCoin = {}; // sıfırla

  coinsData.forEach(({coin, value}) => {
    const blockReward = league ? getBlockReward(league.name, coin) : null;
    let blockRewardCell = "—";
    let rewardCell = "—";
    let gunluk = "—";

    if (blockReward !== null && !isNaN(Number(blockReward))) {
      let reward = 0;
      if (value > 0) {
        reward = (userPower / value) * Number(blockReward);
        rewardCell = reward.toFixed(8);
        gunluk = reward * 144;
      }
      blockRewardCell = String(blockReward);
      rewardsByCoin[coin] = reward; // <- burada değişkene atıyoruz
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${coin}</td>
      <td>${value.toLocaleString()}</td>
      <td>${blockRewardCell}</td>
      <td>${rewardCell}</td>
      <td>${gunluk.toFixed(8)}</td>
    `;
    tbody.appendChild(tr);
  });

  // fiyatları çekip USD karşılığı tabloyu göster
  await fetchPricesAndShow();
}

async function fetchPricesAndShow() {
  const coins = Object.keys(rewardsByCoin);
  if (coins.length === 0) return;

  // CoinGecko ID eşlemesi (gerektiğinde eklenebilir)
  const idMap = {
    BTC: "bitcoin",
    ETH: "ethereum",
    BNB: "binancecoin",
    LTC: "litecoin",
    DOGE: "dogecoin",
    XRP: "ripple",
    TRX: "tron",
    SOL: "solana",
    POL: "polygon-ecosystem-token",
    RLT: "manual_rlt", // CoinGecko’da yok
    RST: "manual_rst", 
  };

  const validIds = coins.map(c => idMap[c]).filter(id => id !== null);
  if (validIds.length === 0) return;

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${validIds.join(",")}&vs_currencies=usd`;
  const res = await fetch(url);
  const prices = await res.json();

// Manuel fiyatlar ekle
  if (coins.includes("RLT")) {
    prices["manual_rlt"] = { usd: 1.0 };
  }
if (coins.includes("RST")) {
    prices["manual_rst"] = { usd: 0.011 };
  }
  // yeni tablo oluştur
  let html = `<h3>USD Karşılığı</h3>
    <table>
      <thead><tr><th>Coin</th><th>USD Fiyatı</th><th>Blok USD</th><th>Günlük USD</th><th>Haftalık USD</th><th>Aylık USD</th></tr></thead>
      <tbody>`;
 

  coins.forEach(c => {
    const reward = rewardsByCoin[c] || 0;
    const id = idMap[c];
    if (!id || !prices[id]) return;

    const price = prices[id].usd;
    const total = reward * price;
    const daily = total * 144;
    const weekly = daily * 7;
    const month  = daily * 30;
    html += `<tr>
      <td>${c}</td>
      <td>$${price.toLocaleString()}</td>
      <td>$${total.toFixed(3)}</td>
	<td>$${daily.toFixed(3)}</td>
	<td>$${weekly.toFixed(3)}</td>
	<td>$${month.toFixed(3)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;

  // Yeni div eklemek yerine var olan tabloyu güncelle
  document.getElementById("usdTable").innerHTML = html;
}

// event listeners
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("parseBtn").addEventListener("click", parseData);
  document.getElementById("calcBtn").addEventListener("click", calculateRewards);
});
