import { io } from "socket.io-client";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const socket = io("/", { autoConnect: true });

export default socket;
