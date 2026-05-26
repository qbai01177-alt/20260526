let mergedData = [];
let isLoading = true;
let errorMessage = "";
let mappa;
let myMap;
let canvas;

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
    fill(255, 100, 100);
    text("資料載入中，請稍候...", width / 2, height / 2);
    return;
  }

  // 處理錯誤狀態
  if (errorMessage !== "") {
    textSize(24);
    textAlign(CENTER, CENTER);
    fill(255, 100, 100);
    text(errorMessage, width / 2, height / 2);
    return;
  }

  let hoveredStation = null;

  // 繪製所有的測站圓點
  for (let i = 0; i < mergedData.length; i++) {
    let st = mergedData[i];
    // 將經緯度轉換為畫布上的 XY 座標
    let pos = myMap.latLngToPixel(st.lat, st.lon);

    // 計算滑鼠與圓點的距離 (用以判斷是否懸停)
    let d = dist(mouseX, mouseY, pos.x, pos.y);
    let radius = 8;
    let isHovered = d < radius;

    if (isHovered) {
      hoveredStation = st;
      radius = 12; // 滑鼠懸停時放大圓點
      fill(255, 100, 100); // 亮紅色
    } else {
      fill(255, 0, 0, 200); // 預設紅色(半透明)
    }
    
    noStroke();
    ellipse(pos.x, pos.y, radius * 2, radius * 2);

    // 在地圖上顯示該站名
    fill(255);
    textSize(12);
    textAlign(LEFT, CENTER);
    text(st.name, pos.x + 12, pos.y);
  }

  // 若有滑鼠懸停的測站，繪製資料顯示面板 (Tooltip) 在最上層
  if (hoveredStation) {
    textSize(16);
    let nameStr = `${hoveredStation.name} 測站`;
    let rainStr = `10分鐘雨量: ${hoveredStation.rain} mm`;
    
    // 根據文字長度決定背景框寬度
    let tw = max(textWidth(nameStr), textWidth(rainStr));
    let tx = mouseX + 15;
    let ty = mouseY + 15;
    
    // 畫出半透明黑色背景框
    fill(0, 0, 0, 200);
    rect(tx - 10, ty - 10, tw + 20, 60, 8);
    
    // 畫出白色文字
    fill(255);
    textAlign(LEFT, TOP);
    text(nameStr, tx, ty);
    text(rainStr, tx, ty + 25);
  }
}

async function fetchData(taipeiUrl) {
  try {
    // 取得台北市 API 請求
    const taipeiRes = await fetch(taipeiUrl);
    const taipeiJson = await taipeiRes.json();

    // 將台北市的雨量資料比對自訂的對照表，對應上經緯度
    if (taipeiJson.data) {
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
}
