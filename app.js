
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
      team: null
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
      team: null
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
      } else {
        phaseText.textContent = `Phase: ${roomData.phase}`;
      }
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
      docId: docSnap.id,
      ...docSnap.data()
    }));

    const shuffledPlayers = shuffleArray(players);
    const murdererId = shuffledPlayers[0].id;

    const batch = writeBatch(db);

    players.forEach((player) => {
      const playerRef = doc(db, "rooms", currentRoomCode, "players", player.id);

      if (player.id === murdererId) {
        batch.update(playerRef, {
          role: "murderer",
          team: "murderer"
        });
      } else {
        batch.update(playerRef, {
          role: "villager",
          team: "village"
        });
      }
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