const iceServers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }] // Servidor STUN gratuito de Google
};

const startSharingButton = document.getElementById("startSharing");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const playVideoButton = document.getElementById("playVideoButton");
const signalingChannel = new BroadcastChannel("webrtc-signaling");

let sendPeerConnection; // Para enviar pantalla
let receivePeerConnection; // Para recibir pantalla

let isSharing = false;
let iceCandidatesBuffer = [];

// 🔹 Función para iniciar el envío de pantalla
async function startScreenSharing() {
    if (isSharing) return;
    isSharing = true;

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        localVideo.srcObject = stream;

        if (sendPeerConnection) sendPeerConnection.close();
        sendPeerConnection = new RTCPeerConnection(iceServers);

        // Agregar nuestro video compartido a la conexión
        stream.getTracks().forEach(track => sendPeerConnection.addTrack(track, stream));

        sendPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                signalingChannel.postMessage({ type: "send-candidate", candidate: event.candidate.toJSON() });
            }
        };

        const offer = await sendPeerConnection.createOffer();
        await sendPeerConnection.setLocalDescription(offer);
        signalingChannel.postMessage({ type: "send-offer", offer });

    } catch (error) {
        console.error("❌ Error al compartir pantalla:", error);
        isSharing = false;
    }
}

// 🔹 Manejo de mensajes de señalización
signalingChannel.onmessage = async (event) => {
    console.log("📩 Mensaje recibido:", event.data);

    if (event.data.type === "send-offer") {
        console.log("🔵 Recibiendo oferta de otra pestaña...");

        if (!receivePeerConnection) {
            receivePeerConnection = new RTCPeerConnection(iceServers);

            // 🔥 Se asegura que siempre se asigne `ontrack`
            receivePeerConnection.ontrack = (event) => {
                console.log("✅ Stream recibido:", event.streams[0]);
                remoteVideo.srcObject = event.streams[0];

                remoteVideo.play().catch(error => {
                    console.warn("⚠️ No se pudo reproducir automáticamente:", error);
                    playVideoButton.style.display = "inline-block"; // Mostrar el botón si falla
                });
            };

            receivePeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    signalingChannel.postMessage({ type: "receive-candidate", candidate: event.candidate.toJSON() });
                }
            };
        }

        await receivePeerConnection.setRemoteDescription(new RTCSessionDescription(event.data.offer));

        while (iceCandidatesBuffer.length > 0) {
            let candidate = iceCandidatesBuffer.shift();
            console.log("✅ Aplicando ICE Candidate del buffer:", candidate);
            await receivePeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }

        const answer = await receivePeerConnection.createAnswer();
        await receivePeerConnection.setLocalDescription(answer);
        signalingChannel.postMessage({ type: "send-answer", answer });

    } else if (event.data.type === "send-answer") {
        console.log("🟢 Aplicando respuesta de la otra pestaña...");

        if (!sendPeerConnection) {
            console.warn("⚠️ `sendPeerConnection` no está inicializado, creando nuevo...");
            sendPeerConnection = new RTCPeerConnection(iceServers);
        }

        await sendPeerConnection.setRemoteDescription(new RTCSessionDescription(event.data.answer));

    } else if (event.data.type === "send-candidate" || event.data.type === "receive-candidate") {
        console.log("📌 Agregando ICE Candidate...");

        let targetPeerConnection = event.data.type === "send-candidate" ? receivePeerConnection : sendPeerConnection;

        if (targetPeerConnection && targetPeerConnection.remoteDescription) {
            await targetPeerConnection.addIceCandidate(new RTCIceCandidate(event.data.candidate));
        } else {
            console.warn("⚠️ ICE Candidate recibido antes de setRemoteDescription(). Guardando en buffer.");
            iceCandidatesBuffer.push(event.data.candidate);
        }
    }
};

// 🔹 Botón para compartir pantalla
startSharingButton.addEventListener("click", startScreenSharing);

// 🔹 Botón de reproducción manual con mute para Chrome
playVideoButton.addEventListener("click", () => {
    if (remoteVideo.srcObject) {
        remoteVideo.muted = true; // 🔥 Solución para Chrome
        remoteVideo.play().then(() => {
            console.log("▶ Video reproduciéndose correctamente.");
            playVideoButton.style.display = "none"; // Ocultar botón después de hacer clic
        }).catch(error => {
            console.error("❌ No se pudo iniciar la reproducción manualmente:", error);
        });
    } else {
        console.warn("⚠️ No hay ningún stream disponible para reproducir.");
    }
});

