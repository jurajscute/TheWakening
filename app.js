
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQpkKgqM9Jse1ju39S_DRcyst3Jf_h4iY",
  authDomain: "the-wakening.firebaseapp.com",
  projectId: "the-wakening",
  storageBucket: "the-wakening.firebasestorage.app",
  messagingSenderId: "349435615649",
  appId: "1:349435615649:web:73d0f1a7b8da8ef214d3e0",
  measurementId: "G-ZPBLWY5TF9"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

let currentRoomCode = null;
let currentPlayerId = null;
let currentPlayerName = null;
let currentUnsubscribePlayers = null;
let currentUnsubscribeRoom = null;
let currentPlayers = [];
let currentRoomData = null;

const menu = document.getElementById("menu");
const roomScreen = document.getElementById("room");
const gameScreen = document.getElementById("game");

const roomCodeText = document.getElementById("roomCode");
const gameRoomCode = document.getElementById("gameRoomCode");
const roomStatus = document.getElementById("roomStatus");
const playerList = document.getElementById("playerList");
const alivePlayerList = document.getElementById("alivePlayerList");
const phaseText = document.getElementById("phaseText");

const roleCard = document.getElementById("roleCard");
const roleName = document.getElementById("roleName");
const roleTeam = document.getElementById("roleTeam");
const roleDescription = document.getElementById("roleDescription");

const actionPanel = document.getElementById("actionPanel");
const actionText = document.getElementById("actionText");
const actionControls = document.getElementById("actionControls");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const leaveBtn = document.getElementById("leaveBtn");

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId() {
  return "p_" + Math.random().toString(36).slice(2, 11);
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRoleInfo(role) {
  if (role === "murderer") {
    return {
      name: "Murderer",
      team: "Murderer Team",
      description: "Each night, you choose a player to kill. You win when murderers equal or outnumber the village.",
      className: "role-murderer"
    };
  }

  return {
    name: "Villager",
    team: "Village Team",
    description: "You have no night action. Find and vote out all murderers to win.",
    className: "role-villager"
  };
}

function showRoomUI(roomCode) {
  menu.style.display = "none";
  roomScreen.style.display = "block";
  gameScreen.style.display = "none";
  roomCodeText.textContent = roomCode;
}

function showGameUI(roomCode) {
  menu.style.display = "none";
  roomScreen.style.display = "none";
  gameScreen.style.display = "block";
  gameRoomCode.textContent = roomCode;
}

function showMenuUI() {
  menu.style.display = "block";
  roomScreen.style.display = "none";
  gameScreen.style.display = "none";
  roomCodeText.textContent = "";
  roomStatus.textContent = "";
  playerList.innerHTML = "";
  alivePlayerList.innerHTML = "";
  actionText.textContent = "";
  actionControls.innerHTML = "";
  startBtn.style.display = "none";
}

function cleanupListeners() {
  if (currentUnsubscribePlayers) {
    currentUnsubscribePlayers();
    currentUnsubscribePlayers = null;
  }
  if (currentUnsubscribeRoom) {
    currentUnsubscribeRoom();
    currentUnsubscribeRoom = null;
  }
}

function resetLocalState() {
  currentRoomCode = null;
  currentPlayerId = null;
  currentPlayerName = null;
  currentPlayers = [];
  currentRoomData = null;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderAlivePlayers(players) {
  alivePlayerList.innerHTML = "";

  players
    .filter((player) => player.isAlive)
    .forEach((player) => {
      const li = document.createElement("li");
      li.textContent = player.name;
      alivePlayerList.appendChild(li);
    });
}

function renderRole(role) {
  const info = getRoleInfo(role);
  roleName.textContent = info.name;
  roleTeam.textContent = info.team;
  roleDescription.textContent = info.description;

  roleCard.className = "role-card";
  roleCard.classList.add(info.className);
}

function getMe() {
  return currentPlayers.find((player) => player.id === currentPlayerId) || null;
}

function getAlivePlayers() {
  return currentPlayers.filter((player) => player.isAlive);
}

function getAliveOtherPlayers() {
  return currentPlayers.filter(
    (player) => player.isAlive && player.id !== currentPlayerId
  );
}

function renderActionPanel() {
  actionControls.innerHTML = "";

  if (!currentRoomData) return;

  const me = getMe();
  if (!me) return;

  if (!me.isAlive) {
    actionText.textContent = "You are dead and cannot act.";
    return;
  }

  if (currentRoomData.phase !== "night_action") {
    actionText.textContent = "Waiting for the next phase...";
    return;
  }

  if (me.readyForPhase) {
    actionText.innerHTML = '<span class="ready-text">You are ready. Waiting for other players...</span>';
    return;
  }

  if (me.role === "murderer") {
    actionText.textContent = "Choose a player to kill tonight.";

    const targets = getAliveOtherPlayers();

    if (targets.length === 0) {
      const btn = document.createElement("button");
      btn.textContent = "No valid targets";
      btn.disabled = true;
      btn.className = "player-action-button";
      actionControls.appendChild(btn);
      return;
    }

    targets.forEach((target) => {
      const btn = document.createElement("button");
      btn.textContent = target.name;
      btn.className = "player-action-button";
      btn.addEventListener("click", () => submitNightAction(target.id));
      actionControls.appendChild(btn);
    });
  } else {
    actionText.textContent = "You have no night action. Click continue when ready.";

    const btn = document.createElement("button");
    btn.textContent = "Continue";
    btn.className = "player-action-button";
    btn.addEventListener("click", markReadyWithoutAction);
    actionControls.appendChild(btn);
  }
}

async function createRoom() {
  try {
    const name = nameInput.value.trim();

    if (!name) {
      alert("Please enter your name.");
      return;
    }

    const roomCode = generateRoomCode();
    const playerId = generatePlayerId();

    const roomRef = doc(db, "rooms", roomCode);
    const playerRef = doc(db, "rooms", roomCode, "players", playerId);

    await setDoc(roomRef, {
      roomCode,
      hostId: playerId,
      status: "lobby",
      createdAt: serverTimestamp(),
      maxPlayers: 20,
      phase: "lobby",
      dayNumber: 0
    });

    await setDoc(playerRef, {
      id: playerId,
      name,
      isHost: true,
      isAlive: true,
      joinedAt: serverTimestamp(),
      role: null,
      team: null,
      readyForPhase: false,
      nightActionTargetId: null
    });

    currentRoomCode = roomCode;
    currentPlayerId = playerId;
    currentPlayerName = name;

    showRoomUI(roomCode);
    subscribeToRoom(roomCode);
    subscribeToPlayers(roomCode);
  } catch (error) {
    console.error("Create room failed:", error);
    alert("Create room failed: " + error.message);
  }
}

async function joinRoom() {
  try {
    const name = nameInput.value.trim();
    const roomCode = roomInput.value.trim().toUpperCase();

    if (!name || !roomCode) {
      alert("Please enter your name and room code.");
      return;
    }

    const roomRef = doc(db, "rooms", roomCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      alert("Room not found.");
      return;
    }

    const roomData = roomSnap.data();

    if (roomData.status !== "lobby") {
      alert("This game has already started.");
      return;
    }

    const playersRef = collection(db, "rooms", roomCode, "players");
    const playersSnap = await getDocs(playersRef);

    if (playersSnap.size >= 20) {
      alert("Room is full.");
      return;
    }

    const playerId = generatePlayerId();
    const playerRef = doc(db, "rooms", roomCode, "players", playerId);

    await setDoc(playerRef, {
      id: playerId,
      name,
      isHost: false,
      isAlive: true,
      joinedAt: serverTimestamp(),
      role: null,
      team: null,
      readyForPhase: false,
      nightActionTargetId: null
    });

    currentRoomCode = roomCode;
    currentPlayerId = playerId;
    currentPlayerName = name;

    showRoomUI(roomCode);
    subscribeToRoom(roomCode);
    subscribeToPlayers(roomCode);
  } catch (error) {
    console.error("Join room failed:", error);
    alert("Join room failed: " + error.message);
  }
}

function subscribeToRoom(roomCode) {
  const roomRef = doc(db, "rooms", roomCode);

  currentUnsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert("This room was closed.");
      leaveRoom(false);
      return;
    }

    const roomData = snapshot.data();
    currentRoomData = roomData;

    if (roomData.status === "lobby") {
      roomStatus.textContent = `Status: ${roomData.status}`;

      if (roomData.hostId === currentPlayerId) {
        startBtn.style.display = "inline-block";
      } else {
        startBtn.style.display = "none";
      }
    } else {
      showGameUI(roomCode);

      if (roomData.phase === "night_action") {
        phaseText.textContent = `Night ${roomData.dayNumber} — Night Action Phase`;
      } else if (roomData.phase === "night_result") {
        phaseText.textContent = `Night ${roomData.dayNumber} — Night Result Phase`;
      } else {
        phaseText.textContent = `Phase: ${roomData.phase}`;
      }

      renderActionPanel();
    }
  });
}

function subscribeToPlayers(roomCode) {
  const playersRef = query(
    collection(db, "rooms", roomCode, "players"),
    orderBy("joinedAt")
  );

  currentUnsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
    const players = [];

    snapshot.forEach((playerDoc) => {
      const player = playerDoc.data();
      players.push(player);
    });

    currentPlayers = players;

    playerList.innerHTML = "";

    players.forEach((player) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="${player.isAlive ? "" : "dead-text"}">
          ${escapeHtml(player.name)}
        </span>
        ${player.isHost ? '<span class="host-badge"> (Host)</span>' : ""}
      `;
      playerList.appendChild(li);
    });

    renderAlivePlayers(players);

    const me = players.find((player) => player.id === currentPlayerId);
    if (me && me.role) {
      renderRole(me.role);
    }

    renderActionPanel();
  });
}

async function startGame() {
  try {
    if (!currentRoomCode || !currentPlayerId) return;

    const roomRef = doc(db, "rooms", currentRoomCode);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();

    if (roomData.hostId !== currentPlayerId) {
      alert("Only the host can start the game.");
      return;
    }

    const playersRef = collection(db, "rooms", currentRoomCode, "players");
    const playersSnap = await getDocs(playersRef);

    if (playersSnap.size < 2) {
      alert("You need at least 2 players to start.");
      return;
    }

    const players = playersSnap.docs.map((docSnap) => ({
      ...docSnap.data()
    }));

    const shuffledPlayers = shuffleArray(players);
    const murdererId = shuffledPlayers[0].id;

    const batch = writeBatch(db);

    players.forEach((player) => {
      const playerRef = doc(db, "rooms", currentRoomCode, "players", player.id);

      batch.update(playerRef, {
        role: player.id === murdererId ? "murderer" : "villager",
        team: player.id === murdererId ? "murderer" : "village",
        readyForPhase: false,
        nightActionTargetId: null,
        isAlive: true
      });
    });

    batch.update(roomRef, {
      status: "in_progress",
      phase: "night_action",
      dayNumber: 1
    });

    await batch.commit();
  } catch (error) {
    console.error("Start game failed:", error);
    alert("Start game failed: " + error.message);
  }
}

async function submitNightAction(targetId) {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    const playerRef = doc(db, "rooms", currentRoomCode, "players", currentPlayerId);

    await updateDoc(playerRef, {
      nightActionTargetId: targetId,
      readyForPhase: true
    });

    await maybeAdvanceNightPhase();
  } catch (error) {
    console.error("Submit night action failed:", error);
    alert("Night action failed: " + error.message);
  }
}

async function markReadyWithoutAction() {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    const playerRef = doc(db, "rooms", currentRoomCode, "players", currentPlayerId);

    await updateDoc(playerRef, {
      readyForPhase: true,
      nightActionTargetId: null
    });

    await maybeAdvanceNightPhase();
  } catch (error) {
    console.error("Ready action failed:", error);
    alert("Ready action failed: " + error.message);
  }
}

async function maybeAdvanceNightPhase() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const playersRef = collection(db, "rooms", currentRoomCode, "players");

    const [roomSnap, playersSnap] = await Promise.all([
      getDoc(roomRef),
      getDocs(playersRef)
    ]);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.phase !== "night_action") return;

    const players = playersSnap.docs.map((docSnap) => docSnap.data());
    const alivePlayers = players.filter((player) => player.isAlive);
    const allReady = alivePlayers.every((player) => player.readyForPhase === true);

    if (!allReady) return;

    await updateDoc(roomRef, {
      phase: "night_result"
    });
  } catch (error) {
    console.error("Advance phase failed:", error);
    alert("Phase advance failed: " + error.message);
  }
}

async function leaveRoom(showMessage = true) {
  if (currentRoomCode && currentPlayerId) {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const playerRef = doc(db, "rooms", currentRoomCode, "players", currentPlayerId);

    try {
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
        const roomData = roomSnap.data();

        await deleteDoc(playerRef);

        const remainingPlayersSnap = await getDocs(collection(db, "rooms", currentRoomCode, "players"));

        if (remainingPlayersSnap.empty) {
          await deleteDoc(roomRef);
        } else if (roomData.hostId === currentPlayerId) {
          const newHost = remainingPlayersSnap.docs[0].data();
          await updateDoc(roomRef, {
            hostId: newHost.id
          });
        }
      }
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  }

  cleanupListeners();
  resetLocalState();
  showMenuUI();

  if (showMessage) {
    alert("You left the room.");
  }
}

createBtn.addEventListener("click", createRoom);
joinBtn.addEventListener("click", joinRoom);
startBtn.addEventListener("click", startGame);
leaveBtn.addEventListener("click", () => leaveRoom(true));