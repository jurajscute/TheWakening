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

const publicMessageText = document.getElementById("publicMessageText");
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
      description: "Each night, you choose a player to kill. You win when murderers equal or outnumber villagers.",
      className: "role-murderer"
    };
  }

  return {
    name: "Villager",
    team: "Village Team",
    description: "You have no night action. Vote out all murderers to win.",
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
  phaseText.textContent = "";
  publicMessageText.textContent = "";
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

function getWinnerFromPlayers(players) {
  const aliveMurderers = players.filter((p) => p.isAlive && p.team === "murderer").length;
  const aliveVillagers = players.filter((p) => p.isAlive && p.team === "village").length;

  if (aliveMurderers === 0) {
    return "village";
  }

  if (aliveMurderers >= aliveVillagers) {
    return "murderer";
  }

  return null;
}

function renderAlivePlayers(players) {
  alivePlayerList.innerHTML = "";

  players.forEach((player) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="${player.isAlive ? "" : "dead-text"}">${escapeHtml(player.name)}</span>
    `;
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

function renderPublicMessage() {
  if (!currentRoomData) return;
  publicMessageText.textContent = currentRoomData.publicMessage || "No message yet.";
}

function renderActionPanel() {
  actionControls.innerHTML = "";

  if (!currentRoomData) return;

  const me = getMe();
  if (!me) return;

  if (!me.isAlive) {
    actionText.textContent = "You are dead and can no longer act.";
    return;
  }

  if (currentRoomData.phase === "night_action") {
    if (me.readyForPhase) {
      actionText.innerHTML = '<span class="ready-text">You are ready. Waiting for other players...</span>';
      return;
    }

    if (me.role === "murderer") {
      actionText.textContent = "Choose a player to kill tonight.";
      const targets = getAliveOtherPlayers();

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

    return;
  }

  if (currentRoomData.phase === "morning") {
    if (me.readyForPhase) {
      actionText.innerHTML = '<span class="ready-text">You are ready. Waiting for other players...</span>';
      return;
    }

    actionText.textContent = "Read the morning message, then continue.";

    const btn = document.createElement("button");
    btn.textContent = "Continue";
    btn.className = "player-action-button";
    btn.addEventListener("click", continueMorning);
    actionControls.appendChild(btn);
    return;
  }

  if (currentRoomData.phase === "voting") {
    if (me.readyForPhase) {
      actionText.innerHTML = '<span class="ready-text">You voted. Waiting for other players...</span>';
      return;
    }

    actionText.textContent = "Choose a player to vote out, or skip.";

    const targets = getAliveOtherPlayers();

    targets.forEach((target) => {
      const btn = document.createElement("button");
      btn.textContent = `Vote: ${target.name}`;
      btn.className = "player-action-button";
      btn.addEventListener("click", () => submitVote(target.id));
      actionControls.appendChild(btn);
    });

    const skipBtn = document.createElement("button");
    skipBtn.textContent = "Skip Vote";
    skipBtn.className = "player-action-button";
    skipBtn.addEventListener("click", () => submitVote("skip"));
    actionControls.appendChild(skipBtn);
    return;
  }

  if (currentRoomData.phase === "vote_result") {
    if (me.readyForPhase) {
      actionText.innerHTML = '<span class="ready-text">You are ready. Waiting for other players...</span>';
      return;
    }

    actionText.textContent = "Read the voting result, then continue.";

    const btn = document.createElement("button");
    btn.textContent = "Continue";
    btn.className = "player-action-button";
    btn.addEventListener("click", continueVoteResult);
    actionControls.appendChild(btn);
    return;
  }

  if (currentRoomData.phase === "game_over") {
    actionText.innerHTML = '<span class="win-text">The game has ended.</span>';
    return;
  }

if (currentRoomData.phase === "night_result") {
  if (me.readyForPhase) {
    actionText.innerHTML = '<span class="ready-text">Waiting for others...</span>';
    return;
  }

  actionText.textContent = me.privateMessage || "No result.";

  const btn = document.createElement("button");
  btn.textContent = "Continue";
  btn.className = "player-action-button";
  btn.addEventListener("click", continueNightResult);
  actionControls.appendChild(btn);
  return;
}

  actionText.textContent = "Waiting for the next phase...";
}

async function continueNightResult() {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      readyForPhase: true
    });

    await maybeAdvanceAfterNightResult();
  } catch (error) {
    console.error("Night result continue failed:", error);
  }
}

async function maybeAdvanceAfterNightResult() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const playersRef = collection(db, "rooms", currentRoomCode, "players");

    const [roomSnap, playersSnap] = await Promise.all([
      getDoc(roomRef),
      getDocs(playersRef)
    ]);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.phase !== "night_result") return;

    const players = playersSnap.docs.map((docSnap) => docSnap.data());
    const alivePlayers = players.filter((p) => p.isAlive);

    const allReady = alivePlayers.every((p) => p.readyForPhase === true);

    if (!allReady) return;

const murderer = players.find((p) => p.isAlive && p.role === "murderer");
const targetId = murderer ? murderer.nightActionTargetId : null;

let morningMessage = "No one died tonight.";
if (targetId) {
  const target = players.find((p) => p.id === targetId);
  if (target) {
    morningMessage = `${target.name} was found dead at dawn.`;
  }
}

await updateDoc(roomRef, {
  phase: "morning",
  publicMessage: morningMessage
});
  } catch (error) {
    console.error("Advance night result failed:", error);
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

    await setDoc(doc(db, "rooms", roomCode), {
      roomCode,
      hostId: playerId,
      status: "lobby",
      createdAt: serverTimestamp(),
      maxPlayers: 20,
      phase: "lobby",
      dayNumber: 0,
      publicMessage: "The room is waiting for players."
    });

    await setDoc(doc(db, "rooms", roomCode, "players", playerId), {
      id: playerId,
      name,
      isHost: true,
      isAlive: true,
      joinedAt: serverTimestamp(),
      role: null,
      team: null,
      readyForPhase: false,
      nightActionTargetId: null,
      voteTargetId: null,
      privateMessage: ""
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

    const playersSnap = await getDocs(collection(db, "rooms", roomCode, "players"));

    if (playersSnap.size >= 20) {
      alert("Room is full.");
      return;
    }

    const playerId = generatePlayerId();

    await setDoc(doc(db, "rooms", roomCode, "players", playerId), {
      id: playerId,
      name,
      isHost: false,
      isAlive: true,
      joinedAt: serverTimestamp(),
      role: null,
      team: null,
      readyForPhase: false,
      nightActionTargetId: null,
      voteTargetId: null,
      privateMessage: ""
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

    currentRoomData = snapshot.data();

    if (currentRoomData.status === "lobby") {
      roomStatus.textContent = `Status: ${currentRoomData.status}`;
      startBtn.style.display = currentRoomData.hostId === currentPlayerId ? "inline-block" : "none";
    } else {
      showGameUI(roomCode);

      if (currentRoomData.phase === "night_action") {
        phaseText.textContent = `Night ${currentRoomData.dayNumber} — Night Action`;
      } else if (currentRoomData.phase === "night_result") {
        phaseText.textContent = `Night ${currentRoomData.dayNumber} — Results`;
      } else if (currentRoomData.phase === "morning") {
        phaseText.textContent = `Day ${currentRoomData.dayNumber} — Morning`;
      } else if (currentRoomData.phase === "voting") {
        phaseText.textContent = `Day ${currentRoomData.dayNumber} — Voting`;
      } else if (currentRoomData.phase === "vote_result") {
        phaseText.textContent = `Day ${currentRoomData.dayNumber} — Vote Result`;
      } else if (currentRoomData.phase === "game_over") {
        phaseText.textContent = "Game Over";
      } else {
        phaseText.textContent = `Phase: ${currentRoomData.phase}`;
      } 

      renderPublicMessage();
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
      players.push(playerDoc.data());
    });

    currentPlayers = players;

    playerList.innerHTML = "";
    players.forEach((player) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="${player.isAlive ? "" : "dead-text"}">${escapeHtml(player.name)}</span>
        ${player.isHost ? '<span class="host-badge"> (Host)</span>' : ""}
      `;
      playerList.appendChild(li);
    });

    renderAlivePlayers(players);

    const me = getMe();
    if (me && me.role) {
      renderRole(me.role);
    }

    renderActionPanel();
  });
}

async function startGame() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.hostId !== currentPlayerId) {
      alert("Only the host can start the game.");
      return;
    }

    const playersSnap = await getDocs(collection(db, "rooms", currentRoomCode, "players"));
    if (playersSnap.size < 2) {
      alert("You need at least 2 players to start.");
      return;
    }

    const players = playersSnap.docs.map((docSnap) => docSnap.data());
    const shuffledPlayers = shuffleArray(players);
    const murdererId = shuffledPlayers[0].id;

    const batch = writeBatch(db);

    players.forEach((player) => {
      batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
        role: player.id === murdererId ? "murderer" : "villager",
        team: player.id === murdererId ? "murderer" : "village",
        readyForPhase: false,
        nightActionTargetId: null,
        voteTargetId: null,
        privateMessage: ""
        isAlive: true
      });
    });

    batch.update(roomRef, {
      status: "in_progress",
      phase: "night_action",
      dayNumber: 1,
      publicMessage: "The first night begins."
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

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      nightActionTargetId: targetId,
      readyForPhase: true
    });

    await maybeResolveNight();
  } catch (error) {
    console.error("Submit night action failed:", error);
    alert("Night action failed: " + error.message);
  }
}

async function markReadyWithoutAction() {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      readyForPhase: true,
      nightActionTargetId: null
    });

    await maybeResolveNight();
  } catch (error) {
    console.error("Ready action failed:", error);
    alert("Ready action failed: " + error.message);
  }
}

async function maybeResolveNight() {
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

    const murderer = alivePlayers.find((player) => player.role === "murderer");
    const targetId = murderer ? murderer.nightActionTargetId : null;

    let publicMessage = "No one died tonight.";
    const batch = writeBatch(db);

    if (targetId) {
      const target = players.find((player) => player.id === targetId);
      if (target && target.isAlive) {
        batch.update(doc(db, "rooms", currentRoomCode, "players", targetId), {
          isAlive: false,
          readyForPhase: false
        });
        publicMessage = `${target.name} was found dead at dawn.`;
      }
    }

    players.forEach((player) => {
      if (player.isAlive && player.id !== targetId) {
        batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
          readyForPhase: false
        });
      }
    });

    // assign private messages
players.forEach((player) => {
  let message = "Nothing happened.";

  if (player.role === "murderer") {
    message = targetId
      ? "Your kill was successful."
      : "Your kill failed.";
  } else {
    message = "You survived the night.";
  }

  batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
    privateMessage: message,
    readyForPhase: false
  });
});

batch.update(roomRef, {
  phase: "night_result",
  publicMessage: "The night is ending..."
});

    await batch.commit();
  } catch (error) {
    console.error("Night resolve failed:", error);
    alert("Night resolve failed: " + error.message);
  }
}

async function continueMorning() {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      readyForPhase: true
    });

    await maybeAdvanceAfterMorning();
  } catch (error) {
    console.error("Morning continue failed:", error);
    alert("Morning continue failed: " + error.message);
  }
}

async function maybeAdvanceAfterMorning() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const playersRef = collection(db, "rooms", currentRoomCode, "players");

    const [roomSnap, playersSnap] = await Promise.all([
      getDoc(roomRef),
      getDocs(playersRef)
    ]);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.phase !== "morning") return;

    const players = playersSnap.docs.map((docSnap) => docSnap.data());
    const winner = getWinnerFromPlayers(players);

    if (winner) {
      await updateDoc(roomRef, {
        phase: "game_over",
        publicMessage: winner === "village" ? "Village wins!" : "Murderers win!"
      });
      return;
    }

    const alivePlayers = players.filter((player) => player.isAlive);
    const allReady = alivePlayers.every((player) => player.readyForPhase === true);

    if (!allReady) return;

    const batch = writeBatch(db);

    alivePlayers.forEach((player) => {
      batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
        readyForPhase: false,
        voteTargetId: null
      });
    });

    batch.update(roomRef, {
      phase: "voting",
      publicMessage: "Discuss and choose someone to eliminate."
    });

    await batch.commit();
  } catch (error) {
    console.error("Advance after morning failed:", error);
    alert("Advance after morning failed: " + error.message);
  }
}

async function submitVote(targetId) {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      voteTargetId: targetId,
      readyForPhase: true
    });

    await maybeResolveVoting();
  } catch (error) {
    console.error("Vote submit failed:", error);
    alert("Vote submit failed: " + error.message);
  }
}

async function maybeResolveVoting() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const playersRef = collection(db, "rooms", currentRoomCode, "players");

    const [roomSnap, playersSnap] = await Promise.all([
      getDoc(roomRef),
      getDocs(playersRef)
    ]);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.phase !== "voting") return;

    const players = playersSnap.docs.map((docSnap) => docSnap.data());
    const alivePlayers = players.filter((player) => player.isAlive);
    const allReady = alivePlayers.every((player) => player.readyForPhase === true);

    if (!allReady) return;

    const voteCounts = {};

    alivePlayers.forEach((player) => {
      const vote = player.voteTargetId || "skip";
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });

    let topKey = null;
    let topCount = -1;
    let tie = false;

    for (const key in voteCounts) {
      const count = voteCounts[key];

      if (count > topCount) {
        topKey = key;
        topCount = count;
        tie = false;
      } else if (count === topCount) {
        tie = true;
      }
    }

    let publicMessage = "The vote ended in a tie. No one was eliminated.";
    const batch = writeBatch(db);

    if (!tie) {
      if (topKey === "skip") {
        publicMessage = "The town chose to skip the vote.";
      } else {
        const eliminatedPlayer = players.find((player) => player.id === topKey);
        if (eliminatedPlayer && eliminatedPlayer.isAlive) {
          batch.update(doc(db, "rooms", currentRoomCode, "players", eliminatedPlayer.id), {
            isAlive: false,
            readyForPhase: false
          });
          publicMessage = `${eliminatedPlayer.name} was voted out.`;
        }
      }
    }

    alivePlayers.forEach((player) => {
      if (player.id !== topKey) {
        batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
          readyForPhase: false
        });
      }
    });

    batch.update(roomRef, {
      phase: "vote_result",
      publicMessage
    });

    await batch.commit();
  } catch (error) {
    console.error("Vote resolve failed:", error);
    alert("Vote resolve failed: " + error.message);
  }
}

async function continueVoteResult() {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      readyForPhase: true
    });

    await maybeAdvanceAfterVoteResult();
  } catch (error) {
    console.error("Vote result continue failed:", error);
    alert("Vote result continue failed: " + error.message);
  }
}

async function maybeAdvanceAfterVoteResult() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const playersRef = collection(db, "rooms", currentRoomCode, "players");

    const [roomSnap, playersSnap] = await Promise.all([
      getDoc(roomRef),
      getDocs(playersRef)
    ]);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.phase !== "vote_result") return;

    const players = playersSnap.docs.map((docSnap) => docSnap.data());
    const winner = getWinnerFromPlayers(players);

    if (winner) {
      await updateDoc(roomRef, {
        phase: "game_over",
        publicMessage: winner === "village" ? "Village wins!" : "Murderers win!"
      });
      return;
    }

    const alivePlayers = players.filter((player) => player.isAlive);
    const allReady = alivePlayers.every((player) => player.readyForPhase === true);

    if (!allReady) return;

    const batch = writeBatch(db);

    alivePlayers.forEach((player) => {
      batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
        readyForPhase: false,
        nightActionTargetId: null,
        voteTargetId: null
      });
    });

    batch.update(roomRef, {
      phase: "night_action",
      dayNumber: roomData.dayNumber + 1,
      publicMessage: "Night falls again."
    });

    await batch.commit();
  } catch (error) {
    console.error("Advance after vote result failed:", error);
    alert("Advance after vote result failed: " + error.message);
  }
}

async function leaveRoom(showMessage = true) {
  if (currentRoomCode && currentPlayerId) {
    try {
      const roomRef = doc(db, "rooms", currentRoomCode);
      const playerRef = doc(db, "rooms", currentRoomCode, "players", currentPlayerId);

      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        const roomData = roomSnap.data();

        await deleteDoc(playerRef);

        const remainingPlayersSnap = await getDocs(collection(db, "rooms", currentRoomCode, "players"));

        if (remainingPlayersSnap.empty) {
          await deleteDoc(roomRef);
        } else if (roomData.hostId === currentPlayerId) {
          const newHost = remainingPlayersSnap.docs[0].data();
          await updateDoc(roomRef, { hostId: newHost.id });
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