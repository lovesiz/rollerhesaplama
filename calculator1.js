/* calculator1.js */

const withdrawLimits = {
  BTC: 0.00085,
  ETH: 0.014,
  DOGE: 220,
  XRP: 40,
  TRX: 300,
  BNB: 0.06,
  POL: 300,
  SOL: 0.6,
  LTC: 5,
};

let coinsData = [];
let rewardsByCoin = {};

/* =========================================
   YENİ VERİ FORMATINI AYIKLAMA
========================================= */

function parseData() {
  const raw = document.getElementById("inputData").value || "";

  let lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  coinsData = [];

  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  let currentCoin = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Coin kodunu yakala
    if (
      /^[A-Z0-9]{2,10}$/.test(line) &&
      ![
        "POWER",
        "ACTIVE",
        "USERS",
        "PER",
        "BLOCK",
        "BLOCKTIME",
        "CRYPTO",
        "CURRENCIES"
      ].includes(line.toUpperCase())
    ) {
      currentCoin = line.toUpperCase();
    }

    // Power alanını yakala
    if (line.toLowerCase() === "power" && currentCoin) {
      const powerLine = lines[i + 1] || "";

      const powerMatch = powerLine.match(/([\d.,]+)\s*([ZE])h\/s/i);

      if (powerMatch) {
        let num = parseFloat(powerMatch[1].replace(",", "."));
        const unit = powerMatch[2].toUpperCase();

        // Zh => milyon
        // Eh => bin
        const factor = unit === "Z" ? 1_000_000 : 1_000;

        coinsData.push({
          coin: currentCoin,
          value: num * factor
        });
      }
    }
  }

  if (coinsData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">Ayrıştırılacak veri bulunamadı.</td>
      </tr>
    `;
    return;
  }

  // TABLOYA YAZ
  coinsData.forEach(c => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${c.coin}</td>
      <td>${c.value.toLocaleString()}</td>
      <td>—</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
    `;

    tbody.appendChild(tr);
  });
}

/* =========================================
   BLOCK REWARD
========================================= */

function getBlockReward(leagueName, coin) {
  if (typeof BLOCK_REWARDS_BY_LEAGUE === "undefined") return null;

  const leagueObj = BLOCK_REWARDS_BY_LEAGUE[leagueName];

  if (!leagueObj) return null;

  return (leagueObj[coin] !== undefined)
    ? leagueObj[coin]
    : null;
}

/* =========================================
   HESAPLAMA
========================================= */

async function calculateRewards() {

  const userPowerRaw = (
    document.getElementById("userPower").value || ""
  )
    .trim()
    .replace(",", ".");

  const userPower = parseFloat(userPowerRaw);

  // Lig seçimi
  const selectedLeague =
    document.getElementById("leagueSelect").value;

  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  if (!coinsData || coinsData.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          Önce tabloya dönüştür.
        </td>
      </tr>
    `;

    return;
  }

  if (isNaN(userPower) || userPower <= 0) {
    alert("Geçerli bir 'Kendi Gücün' girin.");
    return;
  }

  const leagueRow = document.createElement("tr");

  leagueRow.classList.add("league-row");

  leagueRow.innerHTML = `
    <td colspan="6">
      Hesaplanan Lig: ${selectedLeague}
    </td>
  `;

  tbody.appendChild(leagueRow);

  rewardsByCoin = {};

  coinsData.forEach(({ coin, value }) => {

    const blockReward =
      getBlockReward(selectedLeague, coin);

    let blockRewardCell = "—";
    let rewardCell = "—";
    let gunluk = 0;
    let cekimgun = "—";

    if (
      blockReward !== null &&
      !isNaN(Number(blockReward))
    ) {

      let reward =
        (userPower / value) * Number(blockReward);

      rewardCell = reward.toFixed(8);

      gunluk = reward * 144;

      // Çekim süresi
      if (
        withdrawLimits[coin] &&
        gunluk > 0
      ) {

        const daysNeeded =
          withdrawLimits[coin] / gunluk;

        const d = Math.floor(daysNeeded);

        const h = Math.round(
          (daysNeeded - d) * 24
        );

        cekimgun = `${d}g ${h}s`;
      }

      blockRewardCell = String(blockReward);

      rewardsByCoin[coin] = reward;
    }

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${coin}</td>
      <td>${value.toLocaleString()}</td>
      <td>${blockRewardCell}</td>
      <td>${rewardCell}</td>
      <td>${gunluk.toFixed(8)}</td>
      <td>${cekimgun}</td>
    `;

    tbody.appendChild(tr);
  });

  await fetchPricesAndShow();
}

/* =========================================
   USD FİYATLARI
========================================= */

async function fetchPricesAndShow() {

  const coins = Object.keys(rewardsByCoin);

  if (coins.length === 0) return;

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
    ALGO: "algorand",
    RLT: "manual_rlt",
    RST: "manual_rst",
    HMT: "manual_hmt",
    USDT: "manual_usdt",
  };

  const validIds = coins
    .map(c => idMap[c])
    .filter(id => id !== null);

  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${validIds.join(",")}&vs_currencies=usd`;

  try {

    const res = await fetch(url);

    const prices = await res.json();

    // Manuel coin fiyatları
    if (coins.includes("RLT")) {
      prices["manual_rlt"] = { usd: 1.0 };
    }

    if (coins.includes("RST")) {
      prices["manual_rst"] = { usd: 0.0059 };
    }

    if (coins.includes("HMT")) {
      prices["manual_hmt"] = { usd: 0 };
    }

    if (coins.includes("USDT")) {
      prices["manual_usdt"] = { usd: 1.0 };
    }

    let results = [];

    coins.forEach(c => {

      const reward = rewardsByCoin[c] || 0;

      const id = idMap[c];

      if (!id || !prices[id]) return;

      const price = prices[id].usd;

      const total = reward * price;

      const daily = total * 144;

      results.push({
        coin: c,
        price,
        total,
        daily,
        weekly: daily * 7,
        month: daily * 30
      });
    });

    // Aylık kazanca göre sırala
    results.sort((a, b) => b.month - a.month);

    let html = `
      <h3>
        USD Karşılığı
        (Aylık En Yüksekten En Düşüğe)
      </h3>

      <table>

      <thead>
        <tr>
          <th>Coin</th>
          <th>USD Fiyatı</th>
          <th>Blok USD</th>
          <th>Günlük USD</th>
          <th>Haftalık USD</th>
          <th>Aylık USD</th>
        </tr>
      </thead>

      <tbody>
    `;

    results.forEach(r => {

      html += `
        <tr>
          <td>${r.coin}</td>

          <td>
            $${r.price.toLocaleString()}
          </td>

          <td>
            $${r.total.toFixed(3)}
          </td>

          <td>
            $${r.daily.toFixed(3)}
          </td>

          <td>
            $${r.weekly.toFixed(3)}
          </td>

          <td>
            $${r.month.toFixed(3)}
          </td>
        </tr>
      `;
    });

    html += `
      </tbody>
      </table>
    `;

    document.getElementById("usdTable").innerHTML = html;

  } catch (e) {

    console.error("Fiyatlar çekilemedi", e);
  }
}

/* =========================================
   EVENTS
========================================= */

document.addEventListener("DOMContentLoaded", () => {

  document
    .getElementById("parseBtn")
    .addEventListener("click", parseData);

  document
    .getElementById("calcBtn")
    .addEventListener("click", calculateRewards);
});
