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

const hostGameControls = document.getElementById("hostGameControls");
const returnToLobbyBtn = document.getElementById("returnToLobbyBtn");

const phaseBanner = document.getElementById("phaseBanner");
const phaseBannerEyebrow = document.getElementById("phaseBannerEyebrow");
const phaseBannerTitle = document.getElementById("phaseBannerTitle");
const phaseBannerText = document.getElementById("phaseBannerText");

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

const settingsPanel = document.getElementById("settingsPanel");
const settingsContent = document.getElementById("settingsContent");

const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");

const winScreen = document.getElementById("winScreen");
const winTitle = document.getElementById("winTitle");
const winSubtitle = document.getElementById("winSubtitle");
const winYourRole = document.getElementById("winYourRole");
const winExtra = document.getElementById("winExtra");

const finalRoleList = document.getElementById("finalRoleList");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const startBtn = document.getElementById("startBtn");
const leaveBtn = document.getElementById("leaveBtn");
const restartBtn = document.getElementById("restartBtn");

function getDefaultRoleSettings() {
  return {
    murderer: { enabled: true, max: 1, weight: 100 },
    doctor: { enabled: true, max: 1, weight: 100 },
    watchman: { enabled: true, max: 1, weight: 100 },
    executioner: { enabled: true, max: 1, weight: 50 },
    hysteric: { enabled: true, max: 1, weight: 50 }
  };
}

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
      description: "Each night, you choose a player to kill. You win when murderers equal or outnumber all non-murderers.",
      className: "role-murderer",
      badgeClass: "badge-murderer",
      teamClass: "team-murderer"
    };
  }

  if (role === "doctor") {
    return {
      name: "Doctor",
      team: "Village Team",
      description: "Each night, you choose one player to protect, including yourself. If they are attacked, they survive.",
      className: "role-doctor",
      badgeClass: "badge-doctor",
      teamClass: "team-village"
    };
  }

  if (role === "watchman") {
    return {
      name: "Watchman",
      team: "Village Team",
      description: "Each night, you investigate a player and learn their role.",
      className: "role-watchman",
      badgeClass: "badge-watchman",
      teamClass: "team-village"
    };
  }

  if (role === "executioner") {
    return {
      name: "Executioner",
      team: "Neutral",
      description: "You win if your assigned target is voted out.",
      className: "role-executioner",
      badgeClass: "badge-executioner",
      teamClass: "team-neutral"
    };
  }

  if (role === "hysteric") {
    return {
      name: "Hysteric",
      team: "Neutral",
      description: "You win if you are voted out.",
      className: "role-hysteric",
      badgeClass: "badge-hysteric",
      teamClass: "team-neutral"
    };
  }

  return {
    name: "Villager",
    team: "Village Team",
    description: "You have no night action. Vote out all murderers to win.",
    className: "role-villager",
    badgeClass: "badge-villager",
    teamClass: "team-village"
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
  winScreen.style.display = "none";
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
  settingsContent.innerHTML = "";
  startBtn.style.display = "none";
  restartBtn.style.display = "none";
  hostGameControls.style.display = "none";
  phaseBanner.className = "phase-banner";
  phaseBannerEyebrow.textContent = "Phase";
  phaseBannerTitle.textContent = "The Game Begins";
  phaseBannerText.textContent = "Prepare yourself.";

gameScreen.classList.remove(
  "phase-role-reveal",
  "phase-night-action",
  "phase-night-result",
  "phase-morning",
  "phase-voting",
  "phase-vote-result",
  "phase-game-over"
);

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
  const aliveNonMurderers = players.filter((p) => p.isAlive && p.team !== "murderer").length;

  if (aliveMurderers === 0) {
    return "village";
  }

  if (aliveMurderers >= aliveNonMurderers) {
    return "murderer";
  }

  return null;
}

function renderAlivePlayers(players) {
  alivePlayerList.innerHTML = "";

  players.forEach((player) => {
    const li = document.createElement("li");
    li.className = player.isAlive ? "player-row alive-player" : "player-row dead-player";

    const status = player.isAlive ? "Alive" : "Dead";

    li.innerHTML = `
      <span class="${player.isAlive ? "" : "dead-text"}">${escapeHtml(player.name)}</span>
      <span class="player-status">${status}</span>
    `;

    alivePlayerList.appendChild(li);
  });
}

function renderRole(role) {
  const info = getRoleInfo(role);
  const me = getMe();

  roleName.textContent = info.name;
  roleName.className = info.badgeClass;

  roleTeam.textContent = info.team;
  roleTeam.className = info.teamClass;

  let description = info.description;

  if (me && me.role === "executioner") {
    const target = currentPlayers.find((p) => p.id === me.executionerTargetId);
    if (target) {
      description += ` Your target is ${target.name}.`;
    } else {
      description += " You do not have a valid target.";
    }
  }

  roleDescription.textContent = description;

  roleCard.className = "role-card";
  roleCard.classList.add(info.className);
}

function renderPublicMessage() {
  if (!currentRoomData) return;
  publicMessageText.textContent = currentRoomData.publicMessage || "No message yet.";
}

function renderSettingsPanel() {
  if (!currentRoomData) return;

  const me = getMe();
  const isHost = me && me.isHost;
  const settings = currentRoomData.settings?.roles || getDefaultRoleSettings();

  settingsPanel.style.display = currentRoomData.status === "lobby" ? "block" : "none";
  settingsContent.innerHTML = "";

  const groupedRoles = [
    {
      title: "Murderous",
      subtitle: "Those who thrive in blood and fear.",
      roles: ["murderer"]
    },
    {
      title: "Village",
      subtitle: "Those who resist the darkness.",
      roles: ["doctor", "watchman"]
    },
    {
      title: "Neutral",
      subtitle: "Those who follow their own fate.",
      roles: ["executioner", "hysteric"]
    }
  ];

  const roleMeta = {
    murderer: {
      label: "Murderer",
      flavor: "Kills under cover of night."
    },
    doctor: {
      label: "Doctor",
      flavor: "Protects one soul from death."
    },
    watchman: {
      label: "Watchman",
      flavor: "Learns the true identity of another."
    },
    executioner: {
      label: "Executioner",
      flavor: "Wins if their assigned target is voted out."
    },
    hysteric: {
      label: "Hysteric",
      flavor: "Wins only if they themselves are voted out."
    }
  };

  groupedRoles.forEach((group) => {
    const section = document.createElement("div");
    section.className = "settings-group";

    const header = document.createElement("div");
    header.className = "settings-group-header";
    header.innerHTML = `
      <div class="settings-group-title">${group.title}</div>
      <div class="settings-group-subtitle">${group.subtitle}</div>
    `;
    section.appendChild(header);

    group.roles.forEach((roleKey) => {
      const roleSettings = settings[roleKey] || { enabled: false, max: 0, weight: 0 };
      const meta = roleMeta[roleKey];

      const row = document.createElement("div");
      row.className = `role-setting-row role-setting-card role-setting-${roleKey}`;

      row.innerHTML = `
        <div class="role-setting-main">
          <div class="role-setting-title">${meta.label}</div>
          <div class="role-setting-flavor">${meta.flavor}</div>
        </div>

        <div class="role-setting-control-block">
          <div class="role-setting-label">Enabled</div>
          <label class="switch">
            <input
              type="checkbox"
              data-role="${roleKey}"
              data-field="enabled"
              ${roleSettings.enabled ? "checked" : ""}
              ${isHost ? "" : "disabled"}
            >
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="role-setting-control-block">
          <div class="role-setting-label">Max</div>
          <input
            class="max-input"
            type="number"
            min="0"
            max="10"
            value="${roleSettings.max}"
            data-role="${roleKey}"
            data-field="max"
            ${isHost ? "" : "disabled"}
          >
        </div>

        <div class="role-setting-control-block role-setting-weight-block">
          <div class="role-setting-label">Weight</div>
          <div class="weight-control-row">
            <input
              class="weight-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value="${roleSettings.weight ?? 0}"
              data-role="${roleKey}"
              data-field="weight"
              ${isHost ? "" : "disabled"}
            >
            <span class="weight-value">${roleSettings.weight ?? 0}</span>
          </div>
        </div>
      `;

      section.appendChild(row);
    });

    settingsContent.appendChild(section);
  });

  const note = document.createElement("div");
  note.className = "setting-note";
  note.textContent = isHost
    ? "Host can change role settings before the match begins."
    : "Only the host can change role settings.";
  settingsContent.appendChild(note);

  if (isHost) {
    settingsContent.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", handleSettingChange);
      input.addEventListener("input", handleSettingLivePreview);
    });
  }
}

function handleSettingLivePreview(event) {
  const input = event.target;

  if (input.dataset.field === "weight") {
    const row = input.closest(".role-setting-control-block");
    const valueText = row?.querySelector(".weight-value");
    if (valueText) {
      valueText.textContent = input.value;
    }
  }
}

async function handleSettingChange(event) {
  try {
    const me = getMe();
    if (!me || !me.isHost || !currentRoomData || currentRoomData.status !== "lobby") {
      return;
    }

    const input = event.target;
    const role = input.dataset.role;
    const field = input.dataset.field;

    const existing = currentRoomData.settings?.roles || getDefaultRoleSettings();
    const nextSettings = JSON.parse(JSON.stringify(existing));

    if (!nextSettings[role]) {
      nextSettings[role] = { enabled: false, max: 0, weight: 0 };
    }

    if (field === "enabled") {
      nextSettings[role].enabled = input.checked;
    }

    if (field === "max") {
      let value = parseInt(input.value, 10);
      if (Number.isNaN(value) || value < 0) value = 0;
      if (role === "murderer" && value < 1) value = 1;
      input.value = value;
      nextSettings[role].max = value;
    }

    if (field === "weight") {
      let value = parseInt(input.value, 10);
      if (Number.isNaN(value) || value < 0) value = 0;
      input.value = value;
      nextSettings[role].weight = value;
    }

    if (role === "murderer") {
      nextSettings.murderer.enabled = true;
      if (nextSettings.murderer.max < 1) {
        nextSettings.murderer.max = 1;
      }
      if (nextSettings.murderer.weight == null) {
        nextSettings.murderer.weight = 100;
      }
    }

    const saveSettings = async () => {
      await updateDoc(doc(db, "rooms", currentRoomCode), {
        settings: {
          roles: nextSettings
        }
      });
    };

    // Let the switch animation finish before rerendering from Firestore
    if (field === "enabled") {
      setTimeout(() => {
        saveSettings().catch((error) => {
          console.error("Setting update failed:", error);
          alert("Setting update failed: " + error.message);
        });
      }, 180);
      return;
    }

    await saveSettings();
  } catch (error) {
    console.error("Setting update failed:", error);
    alert("Setting update failed: " + error.message);
  }
}

function pickWeightedRole(rolePool) {
  const validRoles = rolePool.filter((role) => role.weight > 0);

  if (validRoles.length === 0) return null;

  const totalWeight = validRoles.reduce((sum, role) => sum + role.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const role of validRoles) {
    roll -= role.weight;
    if (roll <= 0) {
      return role.key;
    }
  }

  return validRoles[validRoles.length - 1].key;
}

function buildRoleAssignments(players, settings) {
  const shuffledPlayers = shuffleArray(players);
  const assignments = [];
  const remainingPlayers = [...shuffledPlayers];

  const murdererSettings = settings.murderer || { enabled: true, max: 1, weight: 100 };
  const murdererCount = Math.max(1, murdererSettings.max);

  for (let i = 0; i < murdererCount && remainingPlayers.length > 0; i++) {
    const player = remainingPlayers.shift();
    assignments.push({
      id: player.id,
      role: "murderer",
      team: "murderer"
    });
  }

  const roleCounts = {
    doctor: 0,
    watchman: 0,
    executioner: 0,
    hysteric: 0
  };

  while (remainingPlayers.length > 0) {
    const rolePool = [];

    ["doctor", "watchman", "executioner", "hysteric"].forEach((roleKey) => {
      const roleSettings = settings[roleKey];
      if (!roleSettings) return;
      if (!roleSettings.enabled) return;
      if (roleCounts[roleKey] >= roleSettings.max) return;

      rolePool.push({
        key: roleKey,
        weight: roleSettings.weight ?? 0
      });
    });

    const chosenRole = pickWeightedRole(rolePool);
    const player = remainingPlayers.shift();

    if (!chosenRole) {
      assignments.push({
        id: player.id,
        role: "villager",
        team: "village"
      });
      continue;
    }

    roleCounts[chosenRole]++;

    assignments.push({
      id: player.id,
      role: chosenRole,
      team:
        chosenRole === "executioner" || chosenRole === "hysteric"
          ? "neutral"
          : "village"
    });
  }

  return assignments;
}

async function continueRoleReveal() {
  try {
    const me = getMe();
    if (!me) return;

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      readyForPhase: true
    });

    await maybeAdvanceAfterRoleReveal();
  } catch (error) {
    console.error("Role reveal continue failed:", error);
    alert("Role reveal continue failed: " + error.message);
  }
}

async function maybeAdvanceAfterRoleReveal() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const playersRef = collection(db, "rooms", currentRoomCode, "players");

    const [roomSnap, playersSnap] = await Promise.all([
      getDoc(roomRef),
      getDocs(playersRef)
    ]);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.phase !== "role_reveal") return;

    const players = playersSnap.docs.map((docSnap) => docSnap.data());
    const allReady = players.every((player) => player.readyForPhase === true);

    if (!allReady) return;

    const batch = writeBatch(db);

    players.forEach((player) => {
      batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
        readyForPhase: false
      });
    });

    batch.update(roomRef, {
      phase: "night_action",
      publicMessage: "The first night begins."
    });

    await batch.commit();
  } catch (error) {
    console.error("Advance after role reveal failed:", error);
    alert("Advance after role reveal failed: " + error.message);
  }
}

function setPhaseAppearance(phase) {
  gameScreen.classList.remove(
    "phase-role-reveal",
    "phase-night-action",
    "phase-night-result",
    "phase-morning",
    "phase-voting",
    "phase-vote-result",
    "phase-game-over"
  );
  gameScreen.classList.remove("role-reveal-mode");

  if (phase === "role_reveal") {
    gameScreen.classList.add("role-reveal-mode");
    gameScreen.classList.add("phase-role-reveal");
    phaseBanner.className = "phase-banner phase-role-reveal";
    phaseBannerEyebrow.textContent = "Opening";
    phaseBannerTitle.textContent = "Role Reveal";
    phaseBannerText.textContent = "Study your fate before the first night begins.";
    return;
  }

  if (phase === "night_action") {
    gameScreen.classList.add("phase-night-action");
    phaseBanner.className = "phase-banner phase-night-action";
    phaseBannerEyebrow.textContent = "Night";
    phaseBannerTitle.textContent = "Night Action";
    phaseBannerText.textContent = "Darkness stirs. Make your move in secret.";
    return;
  }

  if (phase === "night_result") {
    gameScreen.classList.add("phase-night-result");
    phaseBanner.className = "phase-banner phase-night-result";
    phaseBannerEyebrow.textContent = "Night";
    phaseBannerTitle.textContent = "Night Results";
    phaseBannerText.textContent = "The shadows whisper what became of the night.";
    return;
  }

  if (phase === "morning") {
    gameScreen.classList.add("phase-morning");
    phaseBanner.className = "phase-banner phase-morning";
    phaseBannerEyebrow.textContent = "Dawn";
    phaseBannerTitle.textContent = "Morning";
    phaseBannerText.textContent = "The village wakes to the consequences.";
    return;
  }

  if (phase === "voting") {
    gameScreen.classList.add("phase-voting");
    phaseBanner.className = "phase-banner phase-voting";
    phaseBannerEyebrow.textContent = "Judgment";
    phaseBannerTitle.textContent = "Voting";
    phaseBannerText.textContent = "Choose who will face the town’s wrath.";
    return;
  }

  if (phase === "vote_result") {
    gameScreen.classList.add("phase-vote-result");
    phaseBanner.className = "phase-banner phase-vote-result";
    phaseBannerEyebrow.textContent = "Judgment";
    phaseBannerTitle.textContent = "Vote Result";
    phaseBannerText.textContent = "The verdict has been decided.";
    return;
  }

  if (phase === "game_over") {
    gameScreen.classList.add("phase-game-over");
    phaseBanner.className = "phase-banner phase-game-over";
    phaseBannerEyebrow.textContent = "Finale";
    phaseBannerTitle.textContent = "Game Over";
    phaseBannerText.textContent = "The village's tale has come to an end.";
    return;
  }

  phaseBanner.className = "phase-banner";
  phaseBannerEyebrow.textContent = "Phase";
  phaseBannerTitle.textContent = "The Wakening";
  phaseBannerText.textContent = "The story continues.";
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

if (currentRoomData.phase === "role_reveal") {
  if (me.readyForPhase) {
    actionText.innerHTML = '<span class="ready-text">You are ready. Waiting for other players...</span>';
    return;
  }

  actionText.textContent = "Read your role carefully. When you are ready, step into the night.";

  const btn = document.createElement("button");
  btn.textContent = "Continue";
  btn.className = "player-action-button action-continue";
  btn.addEventListener("click", continueRoleReveal);
  actionControls.appendChild(btn);
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
btn.textContent = `Kill ${target.name}`;
btn.className = "player-action-button action-kill";
btn.addEventListener("click", () => submitNightAction(target.id));
actionControls.appendChild(btn);
      });
    } else if (me.role === "doctor") {
      actionText.textContent = "Choose a player to protect tonight.";
      const targets = getAlivePlayers();

      targets.forEach((target) => {
        const btn = document.createElement("button");
btn.textContent = `Protect ${target.name}`;
btn.className = "player-action-button action-protect";
btn.addEventListener("click", () => submitDoctorAction(target.id));
actionControls.appendChild(btn);
      });
    } else if (me.role === "watchman") {
      actionText.textContent = "Choose a player to investigate.";
      const targets = getAliveOtherPlayers();

      targets.forEach((target) => {
        const btn = document.createElement("button");
btn.textContent = `Question ${target.name}`;
btn.className = "player-action-button action-investigate";
btn.addEventListener("click", () => submitWatchmanAction(target.id));
actionControls.appendChild(btn);
      });
    } else {
      actionText.textContent = "You have no night action. Click continue when ready.";

      const btn = document.createElement("button");
btn.textContent = "Continue";
btn.className = "player-action-button action-continue";
btn.addEventListener("click", markReadyWithoutAction);
actionControls.appendChild(btn);
    }

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
    btn.className = "player-action-button action-continue";
    btn.addEventListener("click", continueNightResult);
    actionControls.appendChild(btn);
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
    btn.className = "player-action-button action-continue";
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
btn.textContent = `Vote ${target.name}`;
btn.className = "player-action-button action-vote";
btn.addEventListener("click", () => submitVote(target.id));
actionControls.appendChild(btn);
    });

    const skipBtn = document.createElement("button");
skipBtn.textContent = "Skip Vote";
skipBtn.className = "player-action-button action-skip";
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
    const doctor = players.find((p) => p.isAlive && p.role === "doctor");

    const targetId = murderer ? murderer.nightActionTargetId : null;
    const protectedId = doctor ? doctor.protectTargetId : null;
    const killBlocked = !!targetId && !!protectedId && targetId === protectedId;
    const killSucceeded = !!targetId && !killBlocked;

    let morningMessage = "No one died tonight.";
    if (killSucceeded) {
      const target = players.find((p) => p.id === targetId);
      if (target) {
        morningMessage = `${target.name} was found dead at dawn.`;
      }
    }

    const batch = writeBatch(db);

    alivePlayers.forEach((player) => {
      batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
        readyForPhase: false
      });
    });

    batch.update(roomRef, {
      phase: "morning",
      publicMessage: morningMessage
    });

    await batch.commit();
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
      publicMessage: "The room is waiting for players.",
      settings: {
        roles: getDefaultRoleSettings()
      }
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
      protectTargetId: null,
      investigateTargetId: null,
      voteTargetId: null,
      privateMessage: "",
      executionerTargetId: null,
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
      protectTargetId: null,
      investigateTargetId: null,
      voteTargetId: null,
      privateMessage: "",
      executionerTargetId: null,
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
      showRoomUI(roomCode);
      roomStatus.textContent = `Status: ${currentRoomData.status}`;
      startBtn.style.display = currentRoomData.hostId === currentPlayerId ? "inline-block" : "none";
      winScreen.style.display = "none";
      restartBtn.style.display = "none";
      hostGameControls.style.display = "none";
      renderSettingsPanel();
    } else {
      showGameUI(roomCode);
      setPhaseAppearance(currentRoomData.phase);

      if (currentRoomData.phase === "role_reveal") {
        phaseText.textContent = "Role Reveal";
      } else if (currentRoomData.phase === "night_action") {
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
      renderWinScreen();

const me = getMe();
if (me && me.isHost && currentRoomData.status === "in_progress") {
  hostGameControls.style.display = "block";
} else {
  hostGameControls.style.display = "none";
}

      if (currentRoomData.phase === "game_over" && me && me.isHost) {
        restartBtn.style.display = "inline-block";
      } else {
        restartBtn.style.display = "none";
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
      players.push(playerDoc.data());
    });

    currentPlayers = players;

    playerList.innerHTML = "";
players.forEach((player) => {
  const li = document.createElement("li");
  li.innerHTML = `
    <span class="${player.isAlive ? "" : "dead-text"}">${escapeHtml(player.name)}</span>
    ${player.isHost ? '<span class="host-badge">Host</span>' : ""}
  `;
  playerList.appendChild(li);
});

    renderAlivePlayers(players);

    const me = getMe();
    if (me && me.role) {
      renderRole(me.role);
    }

    renderActionPanel();
    renderWinScreen();
    if (currentRoomData?.status === "lobby") {
      renderSettingsPanel();
    }
  });
}

function assignExecutionerTargets(players, roleAssignments) {
  const villageAlignedTargets = roleAssignments
    .filter((a) => a.team === "village" && a.role === "villager")
    .map((a) => a.id);

  const executioners = roleAssignments.filter((a) => a.role === "executioner");

  const targetMap = {};

  executioners.forEach((executioner, index) => {
    if (villageAlignedTargets.length === 0) {
      targetMap[executioner.id] = null;
      return;
    }

    targetMap[executioner.id] = villageAlignedTargets[index % villageAlignedTargets.length];
  });

  return targetMap;
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
    const settings = roomData.settings?.roles || getDefaultRoleSettings();
    const roleAssignments = buildRoleAssignments(players, settings);
    const executionerTargets = assignExecutionerTargets(players, roleAssignments);

    const batch = writeBatch(db);

    roleAssignments.forEach((assignment) => {
      batch.update(doc(db, "rooms", currentRoomCode, "players", assignment.id), {
        role: assignment.role,
        team: assignment.team,
        readyForPhase: false,
        nightActionTargetId: null,
        protectTargetId: null,
        investigateTargetId: null,
        voteTargetId: null,
        privateMessage: "",
        executionerTargetId: executionerTargets[assignment.id] ?? null,
        isAlive: true
      });
    });

    batch.update(roomRef, {
  status: "in_progress",
  phase: "role_reveal",
  dayNumber: 1,
  publicMessage: "Learn your role before the first night begins.",
  winner: null,
  winnerText: ""
});

    await batch.commit();
  } catch (error) {
    console.error("Start game failed:", error);
    alert("Start game failed: " + error.message);
  }
}

async function returnGameToLobby() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.hostId !== currentPlayerId) {
      alert("Only the host can return the game to the lobby.");
      return;
    }

    const playersSnap = await getDocs(collection(db, "rooms", currentRoomCode, "players"));
    const players = playersSnap.docs.map((docSnap) => docSnap.data());

    const batch = writeBatch(db);

    players.forEach((player) => {
      batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
        role: null,
        team: null,
        isAlive: true,
        readyForPhase: false,
        nightActionTargetId: null,
        protectTargetId: null,
        investigateTargetId: null,
        voteTargetId: null,
        privateMessage: "",
        executionerTargetId: null
      });
    });

    batch.update(roomRef, {
      status: "lobby",
      phase: "lobby",
      dayNumber: 0,
      publicMessage: "The room is waiting for players.",
      winner: null,
      winnerText: ""
    });

    await batch.commit();
  } catch (error) {
    console.error("Return to lobby failed:", error);
    alert("Return to lobby failed: " + error.message);
  }
}

async function restartGame() {
  try {
    const roomRef = doc(db, "rooms", currentRoomCode);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    if (roomData.hostId !== currentPlayerId) {
      alert("Only the host can restart the game.");
      return;
    }

    const playersSnap = await getDocs(collection(db, "rooms", currentRoomCode, "players"));
    const players = playersSnap.docs.map((docSnap) => docSnap.data());

    const batch = writeBatch(db);

    players.forEach((player) => {
  batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
    role: null,
    team: null,
    isAlive: true,
    readyForPhase: false,
    nightActionTargetId: null,
    protectTargetId: null,
    investigateTargetId: null,
    voteTargetId: null,
    privateMessage: "",
    executionerTargetId: null
  });
});

    batch.update(roomRef, {
  status: "lobby",
  phase: "lobby",
  dayNumber: 0,
  publicMessage: "The room is waiting for players.",
  winner: null,
  winnerText: ""
});

    await batch.commit();
  } catch (error) {
    console.error("Restart game failed:", error);
    alert("Restart game failed: " + error.message);
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

async function submitDoctorAction(targetId) {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      protectTargetId: targetId,
      readyForPhase: true
    });

    await maybeResolveNight();
  } catch (error) {
    console.error("Doctor action failed:", error);
    alert("Doctor action failed: " + error.message);
  }
}

async function submitWatchmanAction(targetId) {
  try {
    const me = getMe();
    if (!me || !me.isAlive) return;

    await updateDoc(doc(db, "rooms", currentRoomCode, "players", currentPlayerId), {
      investigateTargetId: targetId,
      readyForPhase: true
    });

    await maybeResolveNight();
  } catch (error) {
    console.error("Watchman action failed:", error);
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
    const doctor = alivePlayers.find((player) => player.role === "doctor");
    const watchman = alivePlayers.find((p) => p.role === "watchman");

    const targetId = murderer ? murderer.nightActionTargetId : null;
    const protectedId = doctor ? doctor.protectTargetId : null;
    const investigatedId = watchman ? watchman.investigateTargetId : null;

    const killBlocked = !!targetId && !!protectedId && targetId === protectedId;
    const killSucceeded = !!targetId && !killBlocked;

    const batch = writeBatch(db);

    if (killSucceeded) {
      const target = players.find((player) => player.id === targetId);
      if (target && target.isAlive) {
        batch.update(doc(db, "rooms", currentRoomCode, "players", targetId), {
          isAlive: false,
          readyForPhase: false
        });
      }
    }

    players.forEach((player) => {
      let message = "Nothing happened.";

      if (player.role === "murderer") {
        if (!targetId) {
          message = "Your kill failed.";
        } else if (killBlocked) {
          message = "Your kill failed. Your target was protected.";
        } else {
          message = "Your kill was successful.";
        }
      } else if (player.role === "doctor") {
        if (!protectedId) {
          message = "You did not protect anyone.";
        } else if (killBlocked) {
          const savedPlayer = players.find((p) => p.id === protectedId);
          message = savedPlayer
            ? `You successfully protected ${savedPlayer.name}.`
            : "Your protection was successful.";
        } else {
          message = "Your protection was not needed.";
        }
      } else if (player.role === "watchman") {
        if (!investigatedId) {
          message = "You did not investigate anyone.";
        } else {
          const target = players.find((p) => p.id === investigatedId);
          if (target) {
            message = `${target.name} is a ${target.role}.`;
          }
        }
      } else if (player.role === "hysteric") {
  message = "You crave the rope, the fire, the fall. You must be voted out.";
} else if (player.role === "executioner") {
  const target = players.find((p) => p.id === player.executionerTargetId);
  if (target) {
    message = `Your target is ${target.name}. Get them voted out.`;
  } else {
    message = "You do not have a valid target.";
  }
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
  publicMessage: winner === "village" ? "Village wins!" : "Murderers win!",
  winner,
  winnerText: winner === "village" ? "Village wins!" : "Murderers win!"
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

function getExecutionerWinners(players, eliminatedPlayerId, cause) {
  if (cause !== "vote") return [];

  return players.filter(
    (player) =>
      player.isAlive &&
      player.role === "executioner" &&
      player.executionerTargetId &&
      player.executionerTargetId === eliminatedPlayerId
  );
}

function getHystericWinners(players, eliminatedPlayerId, cause) {
  if (cause !== "vote") return [];

  return players.filter(
    (player) =>
      player.role === "hysteric" &&
      player.id === eliminatedPlayerId
  );
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
    let eliminatedPlayerId = null;
    const batch = writeBatch(db);

    if (!tie) {
      if (topKey === "skip") {
        publicMessage = "The town chose to skip the vote.";
      } else {
        const eliminatedPlayer = players.find((player) => player.id === topKey);
        if (eliminatedPlayer && eliminatedPlayer.isAlive) {
          eliminatedPlayerId = eliminatedPlayer.id;

          batch.update(doc(db, "rooms", currentRoomCode, "players", eliminatedPlayer.id), {
            isAlive: false,
            readyForPhase: false
          });

          publicMessage = `${eliminatedPlayer.name} was voted out.`;
        }
      }
    }

    const hystericWinners = getHystericWinners(players, eliminatedPlayerId, "vote");
    if (hystericWinners.length > 0) {
      const winnerNames = hystericWinners.map((p) => p.name).join(", ");

      players.forEach((player) => {
        batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
          readyForPhase: false
        });
      });

      batch.update(roomRef, {
        phase: "game_over",
        publicMessage,
        winner: "hysteric",
        winnerText: `${winnerNames} won as Hysteric!`
      });

      await batch.commit();
      return;
    }

    const executionerWinners = getExecutionerWinners(players, eliminatedPlayerId, "vote");
    if (executionerWinners.length > 0) {
      const winnerNames = executionerWinners.map((p) => p.name).join(", ");

      players.forEach((player) => {
        batch.update(doc(db, "rooms", currentRoomCode, "players", player.id), {
          readyForPhase: false
        });
      });

      batch.update(roomRef, {
        phase: "game_over",
        publicMessage,
        winner: "executioner",
        winnerText: `${winnerNames} won as Executioner!`
      });

      await batch.commit();
      return;
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
  publicMessage: winner === "village" ? "Village wins!" : "Murderers win!",
  winner,
  winnerText: winner === "village" ? "Village wins!" : "Murderers win!"
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
        protectTargetId: null,
        investigateTargetId: null,
        voteTargetId: null,
        privateMessage: ""
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

function renderWinScreen() {
  if (!currentRoomData || currentRoomData.phase !== "game_over") {
    winScreen.style.display = "none";
    return;
  }

  const me = getMe();
  const myRoleInfo = me && me.role ? getRoleInfo(me.role) : null;

  winScreen.style.display = "flex";
  winTitle.textContent = currentRoomData.winnerText || "Game Over";
  winSubtitle.textContent = currentRoomData.publicMessage || "";
  winYourRole.textContent = myRoleInfo ? `Your role: ${myRoleInfo.name}` : "";

  if (me && me.role === "executioner") {
    const target = currentPlayers.find((p) => p.id === me.executionerTargetId);
    winExtra.textContent = target
      ? `Your assigned target was: ${target.name}`
      : "You did not have a valid target.";
  } else {
    winExtra.textContent = "";
  }

  finalRoleList.innerHTML = "";

  currentPlayers.forEach((player) => {
    const info = getRoleInfo(player.role || "villager");
    const li = document.createElement("li");

    let extra = "";
    if (player.role === "executioner" && player.executionerTargetId) {
      const target = currentPlayers.find((p) => p.id === player.executionerTargetId);
      if (target) {
        extra = ` — Target: ${target.name}`;
      }
    }

    li.textContent = `${player.name} — ${info.name}${extra}`;
    finalRoleList.appendChild(li);
  });

  if (me && me.isHost) {
    restartBtn.style.display = "inline-block";
  } else {
    restartBtn.style.display = "none";
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

returnToLobbyBtn.addEventListener("click", returnGameToLobby);
createBtn.addEventListener("click", createRoom);
joinBtn.addEventListener("click", joinRoom);
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartGame);
leaveBtn.addEventListener("click", () => leaveRoom(true));