import { useEffect, useState } from "react";
import { HomeView, AppView } from "./components/HomeView";
import { OfflineSetupView, OfflineConfig } from "./components/OfflineSetupView";
import { OfflineGameView } from "./components/OfflineGameView";
import { StatisticsView } from "./components/StatisticsView";
import { SettingsView } from "./components/SettingsView";
import { MultiplayerView } from "./components/MultiplayerView";
import { CreateRoomView } from "./components/CreateRoomView";
import { JoinRoomView } from "./components/JoinRoomView";
import { RoomView } from "./components/RoomView";
import { GameView } from "./components/GameView";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { socket } from "./lib/socket";
import { loadSettings } from "./lib/offline-game";
import { initAudio } from "./lib/sounds";
import { GameMode, PublicRoomState } from "./types/game";

function WordigoApp() {
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomState, setRoomState] = useState<PublicRoomState | null>(null);
  const [myId, setMyId] = useState(socket.id || "");
  const [offlineConfig, setOfflineConfig] = useState<OfflineConfig | null>(null);
  // Mode picked on the Multiplayer screen — auto-selected in Create Room.
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

  // Theme bootstrap
  useEffect(() => {
    const settings = loadSettings();
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, []);

  // Track my socket id (reconnects change it)
  useEffect(() => {
    const update = () => setMyId(socket.id || "");
    // Catch connections that completed before this effect registered —
    // otherwise myId stays "" and identity checks (host/word master) break.
    update();
    socket.on("connect", update);
    return () => {
      socket.off("connect", update);
    };
  }, []);

  // Audio unlock on first interaction
  useEffect(() => {
    const unlock = () => {
      initAudio();
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  // ─── Room lifecycle events (single registration point) ─────────────────
  useEffect(() => {
    const apply = (state: PublicRoomState) => setRoomState(state);

    const onCreated = ({ state }: { state: PublicRoomState }) => {
      apply(state);
      setCurrentView("room");
    };
    const onJoined = ({ state }: { state: PublicRoomState }) => {
      apply(state);
      setCurrentView("room");
    };
    const onRoomError = ({ message }: { message: string }) => {
      toast.error(message);
    };
    // ONE handler for game-started: lobby → gameplay.
    const onGameStarted = ({ state }: { state: PublicRoomState }) => {
      apply(state);
      setCurrentView("game");
    };
    // Live lobby updates while waiting for players.
    const onPlayerJoined = ({ state, playerName }: { state: PublicRoomState; playerName?: string }) => {
      apply(state);
      if (playerName) {
        const me = state.hostId === socket.id;
        if (me) toast.success(`${playerName} joined the room`);
      }
    };
    const onPlayerLeft = ({ state }: { state: PublicRoomState }) => apply(state);
    const onPlayerReconnected = ({ state, playerName }: { state: PublicRoomState; playerName?: string }) => {
      apply(state);
      if (playerName) toast.message(`${playerName} reconnected`);
    };
    const onRoomState = ({ state }: { state: PublicRoomState }) => apply(state);

    socket.on("room-created", onCreated);
    socket.on("room-joined", onJoined);
    socket.on("room-error", onRoomError);
    socket.on("game-started", onGameStarted);
    socket.on("player-joined", onPlayerJoined);
    socket.on("player-left", onPlayerLeft);
    socket.on("player-reconnected", onPlayerReconnected);
    socket.on("room-state", onRoomState);
    return () => {
      socket.off("room-created", onCreated);
      socket.off("room-joined", onJoined);
      socket.off("room-error", onRoomError);
      socket.off("game-started", onGameStarted);
      socket.off("player-joined", onPlayerJoined);
      socket.off("player-left", onPlayerLeft);
      socket.off("player-reconnected", onPlayerReconnected);
      socket.off("room-state", onRoomState);
    };
  }, []);

  const startOfflineGame = (config: OfflineConfig) => {
    setOfflineConfig(config);
    setCurrentView("offline-game");
  };

  return (
    <>
      {currentView === "home" && <HomeView onNavigate={setCurrentView} />}
      {currentView === "offline-setup" && (
        <OfflineSetupView onNavigate={setCurrentView} onStart={startOfflineGame} />
      )}
      {currentView === "offline-game" && offlineConfig && (
        <OfflineGameView onNavigate={setCurrentView} config={offlineConfig} />
      )}
      {currentView === "statistics" && <StatisticsView onNavigate={setCurrentView} />}
      {currentView === "settings" && <SettingsView onNavigate={setCurrentView} />}
      {currentView === "multiplayer" && (
        <MultiplayerView onNavigate={setCurrentView} onSelectMode={setSelectedMode} />
      )}
      {currentView === "create-room" && (
        <CreateRoomView
          onNavigate={setCurrentView}
          playerName={playerName}
          setPlayerName={setPlayerName}
          initialMode={selectedMode}
        />
      )}
      {currentView === "join-room" && (
        <JoinRoomView
          onNavigate={setCurrentView}
          playerName={playerName}
          setPlayerName={setPlayerName}
          roomCode={roomCode}
          setRoomCode={setRoomCode}
        />
      )}
      {currentView === "room" && roomState && (
        <RoomView state={roomState} myId={myId} onNavigate={setCurrentView} />
      )}
      {currentView === "game" && roomState && (
        <GameView state={roomState} myId={myId} onNavigate={setCurrentView} />
      )}

      <Toaster position="top-center" expand={false} richColors closeButton />
    </>
  );
}

export default function WordigoGame() {
  return <WordigoApp />;
}
