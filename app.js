let room = null;
let playerName = "";
let players = [];

// Generate simple room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Create room
function createRoom() {
  const nameInput = document.getElementById("nameInput").value;
  if (!nameInput) return alert("Enter your name");

  playerName = nameInput;
  room = generateRoomCode();

  players = [{ name: playerName, isHost: true }];

  showRoom();
}

// Join room (fake for now)
function joinRoom() {
  const nameInput = document.getElementById("nameInput").value;
  const roomInput = document.getElementById("roomInput").value;

  if (!nameInput || !roomInput) return alert("Enter name and room");

  playerName = nameInput;
  room = roomInput.toUpperCase();

  players.push({ name: playerName, isHost: false });

  showRoom();
}

// Show room screen
function showRoom() {
  document.getElementById("menu").style.display = "none";
  document.getElementById("room").style.display = "block";
  document.getElementById("roomCode").innerText = room;

  renderPlayers();
}

// Render players
function renderPlayers() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";

  players.forEach(p => {
    const li = document.createElement("li");
    li.innerText = p.name + (p.isHost ? " (Host)" : "");
    list.appendChild(li);
  });
}

// Start game (placeholder)
function startGame() {
  alert("Game starting soon...");
}