import { startOffline } from "./lib/offline-game.js";
import "./style.css";
import { stopOffline } from "./lib/offline-game.js";
import "./home.css";

const home = document.getElementById("homeScreen");
const game = document.getElementById("gameScreen");
const duel = document.getElementById("duelScreen");
const homeButtons = ["homeSoloButton", "soloModeButton"];

function openSolo() {
  home.classList.add("is-hidden");
  duel.classList.add("is-hidden");
  game.classList.remove("is-hidden");
  startOffline();
}

function openDuel() {
  stopOffline();
  home.classList.add("is-hidden");
  game.classList.add("is-hidden");
  duel.classList.remove("is-hidden");
}

function openHome() {
  stopOffline();
  document.getElementById("gameScreen").classList.add("is-hidden");
  duel.classList.add("is-hidden");
  home.classList.remove("is-hidden");
}

for (const id of [...homeButtons, "soloCardButton"]) document.getElementById(id).addEventListener("click", openSolo);
document.getElementById("homeDuelButton").addEventListener("click", openDuel);
document.getElementById("duelCardButton").addEventListener("click", openDuel);
document.getElementById("duelModeButton").addEventListener("click", openDuel);
document.getElementById("navHomeButton").addEventListener("click", openHome);
document.getElementById("backFromDuel").addEventListener("click", openHome);
document.getElementById("backFromGame").addEventListener("click", openHome);
document.getElementById("duelSearchButton").addEventListener("click", () => {
  const status = document.getElementById("duelStatus");
  status.textContent = "Máy chủ ghép trận chưa được kết nối. Chế độ 1v1 sẽ sẵn sàng khi có backend online.";
  status.dataset.state = "offline";
});

document.getElementById("liveBadge").dataset.state = "ready";
document.getElementById("liveText").textContent = "SẴN SÀNG";
window.addEventListener("pagehide", stopOffline, { once: true });
