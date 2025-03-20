const iceServers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};





const startSharingButton = document.getElementById("startSharing");
const startCameraButton = document.getElementById("startCamera");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const playVideoButton = document.getElementById("playVideoButton");

let currentCall = null; // Para gestionar la llamada actual


function generateShortId() {
    return "user" + Math.floor(Math.random() * 10000); // ID más corto
}

const userId = prompt("Ingresa tu ID único (deja vacío para generar uno):") || generateShortId();
const peer = new Peer(userId, { debug: 2 });

peer.on("open", (id) => (document.getElementById("peerId").textContent = id));

// 🔹 Manejar llamadas entrantes
peer.on("call", (call) => {
    console.log("📞 Llamada entrante...");

    // 🔹 Preguntar si se quiere compartir la cámara o solo recibir el stream
    const compartirCamara = confirm("¿Quieres compartir tu cámara?");

    if (compartirCamara) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
            call.answer(stream); // 🔥 Responder con la cámara activada
            localVideo.srcObject = stream;
            handleIncomingCall(call);
        });
    } else {
        call.answer(); // 🔥 Solo recibe la transmisión sin compartir cámara
        handleIncomingCall(call);
    }
});

// 🔹 Función para manejar el stream recibido
function handleIncomingCall(call) {
    call.on("stream", (remoteStream) => {
        console.log("✅ Stream recibido:", remoteStream);
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play().catch((error) => {
            console.warn("⚠️ No se pudo reproducir automáticamente, esperando interacción.");
            playVideoButton.style.display = "inline-block";
        });
    });

    currentCall = call; // Guardar la referencia de la llamada
}

// 🔹 Función para compartir la pantalla
async function startScreenSharing() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        localVideo.srcObject = stream;

        const peerId = document.getElementById("peerIdInput").value;
        if (!peerId) {
            alert("⚠️ Ingresa el ID del usuario con quien compartir.");
            return;
        }

        const call = peer.call(peerId, stream); // 🔥 Llamada P2P con pantalla
        handleIncomingCall(call);
    } catch (error) {
        console.error("❌ Error al compartir pantalla:", error);
    }
}

// 🔹 Función para compartir la cámara
async function startCameraSharing() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;

        const peerId = document.getElementById("peerIdInput").value;
        if (!peerId) {
            alert("⚠️ Ingresa el ID del usuario con quien compartir.");
            return;
        }

        const call = peer.call(peerId, stream); // 🔥 Llamada P2P con la cámara
        handleIncomingCall(call);
    } catch (error) {
        console.error("❌ Error al compartir cámara:", error);
    }
}

// 🔹 Asignar eventos a los botones
startSharingButton.addEventListener("click", startScreenSharing);
startCameraButton.addEventListener("click", startCameraSharing);

playVideoButton.addEventListener("click", () => {
    console.log("🎥 Botón de reproducción presionado.");
    remoteVideo.play().catch(error => console.error("❌ Error al reproducir:", error));
});
