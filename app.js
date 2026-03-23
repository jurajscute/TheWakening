import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
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
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =====================================
// 1. PASTE YOUR FIREBASE CONFIG HERE
// =====================================
const firebaseConfig = {
  apiKey: "AIzaSyBQpkKgqM9Jse1ju39S_DRcyst3Jf_h4iY",
  authDomain: "the-wakening.firebaseapp.com",
  projectId: "the-wakening",
  storageBucket: "the-wakening.firebasestorage.app",
  messagingSenderId: "349435615649",
  appId: "1:349435615649:web:73d0f1a7b8da8ef214d3e0",
  measurementId: "G-ZPBLWY5TF9"
};

// =====================================
// 2. FIREBASE SETUP
// =====================================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =====================================
// 3. GAME STATE
// =====================================
let currentRoomCode = null;
let currentPlayerId = null;
let currentPlayerName = null;
let currentUnsubscribePlayers = null;
let currentUnsubscribeRoom = null;

// =====================================
// 4. DOM
// =====================================
const menu = document.getElementById("menu");
const roomScreen = document.getElementById("room");
const roomCodeText = document.getElementById("roomCode");
const roomStatus = document.getElementById("roomStatus");
const playerList = document.getElementById("playerList");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const leaveBtn = document.getElementById("leaveBtn");

// =====================================
// 5. HELPERS
// =====================================
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

function showRoomUI(roomCode) {
  menu.style.display = "none";
  roomScreen.style.display = "block";
  roomCodeText.textContent = roomCode;
}

function showMenuUI() {
  menu.style.display = "block";
  roomScreen.style.display = "none";
  roomCodeText.textContent = "";
  roomStatus.textContent = "";
  playerList.innerHTML = "";
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

async function roomExists(roomCode) {
  try {
    const roomRef = doc(db, "rooms", roomCode);
    const roomSnap = await getDoc(roomRef);
    return roomSnap.exists();
  } catch (error) {
    console.error("roomExists error:", error);
    throw error;
  }
}
// =====================================
// 6. CREATE ROOM
// =====================================
async function createRoom() {
  try {
    const name = nameInput.value.trim();

    if (!name) {
      alert("Please enter your name.");
      return;
    }

    let roomCode = generateRoomCode();
    while (await roomExists(roomCode)) {
      roomCode = generateRoomCode();
    }

    const playerId = generatePlayerId();

    const roomRef = doc(db, "rooms", roomCode);
    const playerRef = doc(db, "rooms", roomCode, "players", playerId);

    await setDoc(roomRef, {
      roomCode,
      hostId: playerId,
      status: "lobby",
      createdAt: serverTimestamp(),
      maxPlayers: 20,
      phase: "lobby"
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
    alert("Create room failed. Check console for details.");
  }
}

// =====================================
// 7. JOIN ROOM
// =====================================
async function joinRoom() {
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
}

// =====================================
// 8. LIVE ROOM INFO
// =====================================
function subscribeToRoom(roomCode) {
  const roomRef = doc(db, "rooms", roomCode);

  currentUnsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      alert("This room was closed.");
      leaveRoom(false);
      return;
    }

    const roomData = snapshot.data();
    roomStatus.textContent = `Status: ${roomData.status}`;

    if (roomData.hostId === currentPlayerId && roomData.status === "lobby") {
      startBtn.style.display = "inline-block";
    } else {
      startBtn.style.display = "none";
    }

    if (roomData.status === "in_progress") {
      roomStatus.textContent = "Game has started. Next step: role assignment and phases.";
    }
  });
}

function subscribeToPlayers(roomCode) {
  const playersRef = query(
    collection(db, "rooms", roomCode, "players"),
    orderBy("joinedAt")
  );

  currentUnsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
    playerList.innerHTML = "";

    snapshot.forEach((playerDoc) => {
      const player = playerDoc.data();
      const li = document.createElement("li");

      li.innerHTML = `
        <span class="${player.isAlive ? "" : "dead-text"}">
          ${escapeHtml(player.name)}
        </span>
        ${player.isHost ? '<span class="host-badge"> (Host)</span>' : ""}
      `;

      playerList.appendChild(li);
    });
  });
}

// =====================================
// 9. START GAME
// =====================================
async function startGame() {
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

  await updateDoc(roomRef, {
    status: "in_progress",
    phase: "night_action",
    dayNumber: 1
  });

  alert("Game started! Next we will add role assignment and the real phase loop.");
}

// =====================================
// 10. LEAVE ROOM
// =====================================
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

// =====================================
// 11. SMALL SAFETY HELPER
// =====================================
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// =====================================
// 12. BUTTON EVENTS
// =====================================
createBtn.addEventListener("click", createRoom);
joinBtn.addEventListener("click", joinRoom);
startBtn.addEventListener("click", startGame);
leaveBtn.addEventListener("click", () => leaveRoom(true));