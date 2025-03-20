// funciona para todo los navegadores solo en local solo que en el mismo navegador

const iceServers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const startSharingButton = document.getElementById("startSharing");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const playVideoButton = document.getElementById("playVideoButton");
const signalingChannel = new BroadcastChannel("webrtc-signaling");

let sendPeerConnection = null;
let receivePeerConnection = null;
let isSharing = false;
let iceCandidatesBuffer = [];

// 🔹 Iniciar el compartido de pantalla
async function startScreenSharing() {
    if (isSharing) return;
    isSharing = true;

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        localVideo.srcObject = stream;

        if (!sendPeerConnection) {  
            sendPeerConnection = new RTCPeerConnection(iceServers);
            stream.getTracks().forEach(track => sendPeerConnection.addTrack(track, stream));

            sendPeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    signalingChannel.postMessage({ type: "send-candidate", candidate: event.candidate.toJSON() });
                }
            };
        }

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

            receivePeerConnection.ontrack = (event) => {
                console.log("✅ Stream recibido:", event.streams[0]);

                // 🔹 Verificación extra antes de asignar `srcObject`
                setTimeout(() => {
                    if (!remoteVideo.srcObject) {
                        console.warn("⚠️ Asignando el stream al remoteVideo...");
                        remoteVideo.srcObject = event.streams[0];
                    }

                    remoteVideo.muted = true; // 🔥 Solución para Chrome
                    remoteVideo.play().then(() => {
                        console.log("▶ Video reproduciéndose automáticamente.");
                    }).catch(error => {
                        console.warn("⚠️ No se pudo reproducir automáticamente, esperando interacción.");
                        playVideoButton.style.display = "inline-block"; 
                    });
                }, 500);
            };

            receivePeerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    signalingChannel.postMessage({ type: "receive-candidate", candidate: event.candidate.toJSON() });
                }
            };
        }

        // ✅ **Eliminar la verificación de signalingState para no rechazar ofertas**
        await receivePeerConnection.setRemoteDescription(new RTCSessionDescription(event.data.offer));

        // 🔹 Procesar ICE Candidates en buffer
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
            console.warn("⚠️ `sendPeerConnection` no estaba inicializado. Creando una nueva conexión...");
            sendPeerConnection = new RTCPeerConnection(iceServers);
        }

        await sendPeerConnection.setRemoteDescription(new RTCSessionDescription(event.data.answer));

    } else if (event.data.type === "send-candidate" || event.data.type === "receive-candidate") {
        console.log("📌 Agregando ICE Candidate...");

        let targetPeerConnection = event.data.type === "send-candidate" ? receivePeerConnection : sendPeerConnection;

        if (targetPeerConnection && targetPeerConnection.remoteDescription) {
            console.log("✅ Aplicando ICE Candidate:", event.data.candidate);
            await targetPeerConnection.addIceCandidate(new RTCIceCandidate(event.data.candidate));
        } else {
            console.warn("⚠️ ICE Candidate recibido antes de setRemoteDescription(). Guardando en buffer.");
            iceCandidatesBuffer.push(event.data.candidate);
        }
    }
};

// 🔹 Botón de compartir pantalla
startSharingButton.addEventListener("click", startScreenSharing);

// 🔹 Botón de reproducción manual
playVideoButton.addEventListener("click", () => {
    console.log("🎥 Botón de reproducción presionado.");

    if (remoteVideo.srcObject) {
        console.log("🎥 Intentando reproducir el video...");
    } else {
        console.warn("⚠️ No hay ningún stream disponible para reproducir.");
    }

    remoteVideo.muted = false; // 🔥 Desmutear por seguridad

    setTimeout(() => {
        remoteVideo.play().then(() => {
            console.log("▶ Video reproduciéndose correctamente.");
            playVideoButton.style.display = "none"; 
        }).catch(error => {
            console.error("❌ No se pudo iniciar la reproducción manualmente:", error);
        });
    }, 500);
});
