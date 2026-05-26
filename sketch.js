let mergedData = [];
let isLoading = true;
let errorMessage = "";
let mappa;
let myMap;
let canvas;

// 新增資料時間與雨量分類級距
let dataTime = "";
const rainCategories = [
  { min: -1, max: 0, color: [255, 0, 0], label: "0 mm (紅色)" },
  { min: 0, max: 2, color: [144, 238, 144], label: "0.1 - 2 mm" },
  { min: 2, max: 5, color: [255, 255, 0], label: "2 - 5 mm" },
  { min: 5, max: 10, color: [255, 165, 0], label: "5 - 10 mm" },
  { min: 10, max: 20, color: [255, 69, 0], label: "10 - 20 mm" },
  { min: 20, max: Infinity, color: [200, 50, 255], label: "> 20 mm" }
];

// 新增全域變數
let panelHoveredStation = null;
let rainDrops = [];
let maxRainfall = 0;

function setup() {
  // 建立全螢幕畫布並存為變數
  canvas = createCanvas(windowWidth, windowHeight);
  
  // 初始化 Mappa (使用 Leaflet 作為底圖)
  mappa = new Mappa('Leaflet');
  
  // 設定地圖選項 (中心點設於台北市)
  const options = {
    lat: 25.0330,
    lng: 121.5654,
    zoom: 12,
    style: "http://{s}.tile.osm.org/{z}/{x}/{y}.png"
  };
  
  // 建立地圖並將 p5 畫布疊加在其上
  myMap = mappa.tileMap(options);
  myMap.overlay(canvas);
  
  // 台北市雨量 API 網址
  const apiUrl = 'https://wic.gov.taipei/OpenData/API/Rain/Get?stationNo=&loginId=open_rain&dataKey=85452C1D';

  // 設定 CORS 代理伺服器 (使用 corsproxy.io)
  const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(apiUrl);

  // 取得台北市雨量資料
  fetchData(proxyUrl);

  // 初始化雨滴效果
  initRaindrops();
}

function initRaindrops() {
  rainDrops = [];
  const cloudX = width - 100;
  for (let i = 0; i < 200; i++) {
    rainDrops.push({
      x: random(cloudX - 50, cloudX + 50),
      y: random(-height, 0),
      len: random(10, 20),
      speed: random(4, 10)
    });
  }
}

// 台北市主要測站經緯度座標對照表 (用於地圖定位)
const stationCoords = {
  "湖田國小": { lat: 25.1528, lon: 121.5323 },
  "大屯國小": { lat: 25.1741, lon: 121.4925 },
  "桃源國中": { lat: 25.1397, lon: 121.4914 },
  "北投國小": { lat: 25.1321, lon: 121.5005 },
  "陽明高中": { lat: 25.0945, lon: 121.5148 },
  "太平國小": { lat: 25.0610, lon: 121.5111 },
  "民生國中": { lat: 25.0602, lon: 121.5606 },
  "中正國中": { lat: 25.0336, lon: 121.5201 },
  "三興國小": { lat: 25.0303, lon: 121.5583 },
  "格致國中": { lat: 25.1362, lon: 121.5387 },
  "平等國小": { lat: 25.1278, lon: 121.5714 },
  "至善國中": { lat: 25.1014, lon: 121.5489 },
  "碧湖國小": { lat: 25.0811, lon: 121.5878 },
  "東湖國小": { lat: 25.0689, lon: 121.6169 },
  "瑠公國中": { lat: 25.0372, lon: 121.5847 },
  "舊莊國小": { lat: 25.0402, lon: 121.6186 },
  "博嘉國小": { lat: 25.0000, lon: 121.5886 },
  "北政國中": { lat: 24.9861, lon: 121.5786 },
  "長安國小": { lat: 25.0489, lon: 121.5283 },
  "萬華國中": { lat: 25.0278, lon: 121.4986 },
  "台灣大學(新)": { lat: 25.0175, lon: 121.5397 },
  "雙園": { lat: 25.0232, lon: 121.4925 },
  "中洲": { lat: 25.1235, lon: 121.4608 }
};

function draw() {
  // 清除 p5 畫布背景，以便顯示底層的地圖
  clear();

  // 處理載入中的狀態
  if (isLoading) {
    textSize(24);
    textAlign(CENTER, CENTER);
    // 為了在地圖上看得清楚，加個背景
    fill(0, 0, 0, 150);
    noStroke();
    rect(width / 2 - 150, height / 2 - 30, 300, 60);
    fill(255);
    text("資料載入中，請稍候...", width / 2, height / 2);
    return;
  }

  // 處理錯誤狀態
  if (errorMessage !== "") {
    textSize(24);
    textAlign(CENTER, CENTER);
    fill(0, 0, 0, 150);
    noStroke();
    rect(width / 2 - 300, height / 2 - 30, 600, 60);
    fill(255, 100, 100);
    text(errorMessage, width / 2, height / 2);
    return;
  }

  // 重置面板懸停狀態
  panelHoveredStation = null;

  // 繪製 UI 元素
  drawInfoPanel();
  drawLegend();
  drawWeatherEffect();

  let mapHoveredStation = null;

  // 如果比對後沒有任何測站，顯示提示訊息
  if (mergedData.length === 0 && !isLoading && errorMessage === "") {
    textSize(24);
    textAlign(CENTER, CENTER);
    fill(255, 150, 150);
    text("未能成功對應測站座標，請檢查 API 站名與對照表格式。", width / 2, 80);
  }

  // 繪製所有的測站圓點
  for (let i = 0; i < mergedData.length; i++) {
    let st = mergedData[i];
    // 將經緯度轉換為畫布上的 XY 座標
    let pos = myMap.latLngToPixel(st.lat, st.lon);

    // 確保座標轉換成功且在畫面上才進行繪製
    if (!pos || pos.x === undefined || pos.y === undefined) continue;

    // 計算滑鼠與圓點的距離 (用以判斷是否懸停)
    let d = dist(mouseX, mouseY, pos.x, pos.y);
    let radius = 8;

    let isMapHovered = d < radius;
    if (isMapHovered) {
      mapHoveredStation = st;
    }
    let isHovered = (st === mapHoveredStation) || (st === panelHoveredStation);

    // 根據狀態設定樣式
    noStroke();
    if (isHovered) {
      radius = 12; // 滑鼠懸停時放大圓點
      fill(255, 255, 0); // 懸停時為黃色
    } else {
      let c = getRainColor(st.rain);
      fill(c[0], c[1], c[2], 220); // 根據雨量分類決定顏色
    }
    
    ellipse(pos.x, pos.y, radius * 2, radius * 2);

    // 在地圖上顯示該站名
    fill(255);
    textSize(12);
    textAlign(LEFT, CENTER);
    text(st.name, pos.x + 12, pos.y);
  }

  // 若有滑鼠懸停的測站，繪製資料顯示面板 (Tooltip) 在最上層
  if (mapHoveredStation) {
    drawTooltip(mapHoveredStation);
  }
}

function drawInfoPanel() {
  const panelX = 20;
  const panelY = 80;
  const panelW = 250;
  const panelH = height - 100;
  const itemH = 22;

  // 面板背景
  fill(0, 0, 0, 180);
  noStroke();
  rect(panelX, panelY, panelW, panelH, 10);

  // 面板標題
  fill(255);
  textSize(18);
  textAlign(LEFT, TOP);
  text("各測站雨量 (mm)", panelX + 15, panelY + 15);

  // 資料時間
  textSize(12);
  fill(200, 255, 200);
  text(`資料時間: ${dataTime}`, panelX + 15, panelY + 40);

  // 測站列表
  textSize(14);
  let currentY = panelY + 60;
  for (let i = 0; i < mergedData.length; i++) {
    if (currentY > panelY + panelH - 20) break; // 避免超出面板

    let st = mergedData[i];
    let itemX = panelX + 15;
    
    // 檢查滑鼠是否懸停在項目上
    if (mouseX > itemX && mouseX < itemX + panelW - 30 && mouseY > currentY && mouseY < currentY + itemH) {
      panelHoveredStation = st;
      fill(255, 255, 0); // 懸停時高亮文字
    } else {
      fill(255);
    }
    
    text(`${st.name}: ${st.rain}`, itemX, currentY);
    currentY += itemH;
  }
}

function drawLegend() {
  const legendX = width - 180;
  const legendY = 120;
  const legendW = 160;
  const legendH = 190; // 加高以容納六個分類

  // 背景
  fill(0, 0, 0, 180);
  noStroke();
  rect(legendX, legendY, legendW, legendH, 10);

  // 標題
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text("雨量圖例 (mm)", legendX + 15, legendY + 10);

  // 圖例項目
  let currentY = legendY + 40;
  
  for (let cat of rainCategories) {
    fill(cat.color[0], cat.color[1], cat.color[2]);
    ellipse(legendX + 25, currentY, 12, 12);
    fill(255);
    textSize(12);
    text(cat.label, legendX + 45, currentY - 6);
    currentY += 25;
  }
}

function getRainColor(rain) {
  for (let cat of rainCategories) {
    if (rain > cat.min && rain <= cat.max) return cat.color;
  }
  return [255, 0, 0]; // 預設紅色
}

function drawWeatherEffect() {
  // 找出最大雨量來決定天氣效果
  maxRainfall = 0;
  if (mergedData.length > 0) {
    for (let st of mergedData) {
      maxRainfall = max(maxRainfall, st.rain);
    }
  }

  if (maxRainfall > 0) {
    drawRain();
  } else {
    drawSun();
  }
}

function drawSun() {
  let sunX = width - 80;
  let sunY = 60;
  let sunRadius = 25;
  
  push();
  translate(sunX, sunY);
  
  // 太陽本體
  fill(255, 220, 0);
  noStroke();
  ellipse(0, 0, sunRadius * 2, sunRadius * 2);
  
  // 光線
  stroke(255, 220, 0, 150);
  strokeWeight(3);
  for (let i = 0; i < 8; i++) {
    let angle = TWO_PI / 8 * i + frameCount * 0.01;
    let x1 = cos(angle) * (sunRadius + 5);
    let y1 = sin(angle) * (sunRadius + 5);
    let x2 = cos(angle) * (sunRadius + 15);
    let y2 = sin(angle) * (sunRadius + 15);
    line(x1, y1, x2, y2);
  }
  pop();
}

function drawRain() {
  let cloudX = width - 100;
  let cloudY = 50;

  // 雲
  noStroke();
  fill(150, 150, 150);
  ellipse(cloudX, cloudY, 80, 50);
  ellipse(cloudX + 30, cloudY + 10, 60, 40);
  ellipse(cloudX - 30, cloudY + 10, 60, 40);

  // 雨滴
  stroke(180, 200, 255);
  strokeWeight(2);
  for (let drop of rainDrops) {
    line(drop.x, drop.y, drop.x, drop.y + drop.len);
    drop.y += drop.speed;
    if (drop.y > height) {
      drop.y = random(-100, 0);
      drop.x = random(cloudX - 50, cloudX + 50);
    }
  }
}

function drawTooltip(station) {
  textSize(16);
  let nameStr = `${station.name} 測站`;
  let rainStr = `10分鐘雨量: ${station.rain} mm`;
  
  let tw = max(textWidth(nameStr), textWidth(rainStr));
  let tx = mouseX + 15;
  let ty = mouseY + 15;
  
  // 避免提示框超出畫面
  if (tx + tw + 20 > width) {
    tx = mouseX - tw - 35;
  }
  if (ty + 60 > height) {
    ty = height - 70;
  }

  fill(0, 0, 0, 200);
  noStroke();
  rect(tx, ty, tw + 20, 60, 8);
  
  fill(255);
  textAlign(LEFT, TOP);
  text(nameStr, tx + 10, ty + 10);
  text(rainStr, tx + 10, ty + 35);
}

async function fetchData(taipeiUrl) {
  try {
    // 取得台北市 API 請求
    const taipeiRes = await fetch(taipeiUrl);
    const taipeiJson = await taipeiRes.json();

    // 將台北市的雨量資料比對自訂的對照表，對應上經緯度
    if (taipeiJson.data && taipeiJson.data.length > 0) {
      // 從第一筆觀測資料中取得資料時間 (recTime)，若無則顯示未知
      dataTime = taipeiJson.data[0].recTime || "未知時間";
      
      mergedData = taipeiJson.data.map(st => {
        let name = st.stationName || "未知測站";
        let cwaInfo = stationCoords[name];
        return {
          name: name,
          rain: st.rain10Mins !== undefined ? st.rain10Mins : (st.rain || 0),
          lat: cwaInfo ? cwaInfo.lat : null,
          lon: cwaInfo ? cwaInfo.lon : null
        };
      }).filter(st => st.lat && st.lon); // 過濾掉無法對應到經緯度的測站
    }

    isLoading = false;
  } catch (err) {
    console.error("API Fetch Error:", err);
    errorMessage = "資料讀取失敗，請確認網路連線或 API 狀態。";
    isLoading = false;
  }
}

// 當瀏覽器視窗大小改變時，自動調整全螢幕畫布大小
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initRaindrops(); // 重新初始化雨滴以適應新視窗大小
}
