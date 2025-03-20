const iceServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // Servidor STUN gratuito de Google
    ]
};

const startSharingButton = document.getElementById('startSharing');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const playVideoButton = document.getElementById('playVideoButton'); // Botón de reproducción manual
const signalingChannel = new BroadcastChannel('webrtc-signaling');

let peerConnection;
let isSharing = false; // Si esta pestaña está compartiendo
let iceCandidatesBuffer = []; // Buffer para ICE Candidates antes de setRemoteDescription()

async function startScreenSharing() {
    if (isSharing) return; // Evitar múltiples clics
    isSharing = true;

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        localVideo.srcObject = stream;

        // Cerrar la conexión anterior si existe y está activa
        if (peerConnection && peerConnection.signalingState !== "closed") {
            console.warn("Ya existe una conexión activa. Ignorando nueva oferta.");
            return;
        }

        console.log("🔵 Creando nueva conexión WebRTC...");
        peerConnection = new RTCPeerConnection();

        // Enviar el stream de pantalla
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

        // Manejo de flujo entrante
        peerConnection.ontrack = (event) => {
            console.log("✅ Stream recibido:", event.streams[0]);
            remoteVideo.srcObject = event.streams[0];

            // Intentar reproducir automáticamente
            remoteVideo.play().catch(error => {
                console.warn("⚠️ No se pudo reproducir automáticamente:", error);
                playVideoButton.style.display = "inline-block"; // Mostrar el botón si la reproducción falla
            });
        };

        // Manejo de ICE Candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("📌 Enviando ICE Candidate...");
                signalingChannel.postMessage({ type: 'candidate', candidate: event.candidate.toJSON() });
            }
        };

        // Crear y enviar oferta SDP
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingChannel.postMessage({ type: 'offer', offer });

    } catch (error) {
        console.error('❌ Error al compartir pantalla:', error);
        isSharing = false;
    }
}

// Agregar evento al botón "Reproducir Video"
playVideoButton.addEventListener("click", () => {
    if (remoteVideo.srcObject) {
        remoteVideo.play().then(() => {
            console.log("▶ Video reproduciéndose correctamente.");
            playVideoButton.style.display = "none"; // Ocultar el botón después de hacer clic
        }).catch(error => {
            console.error("❌ No se pudo iniciar la reproducción manualmente:", error);
        });
    } else {
        console.warn("⚠️ No hay ningún stream disponible para reproducir.");
    }
});

signalingChannel.onmessage = async (event) => {
    console.log("📩 Mensaje recibido:", event.data);

    if (event.data.type === 'offer') {
        if (peerConnection && peerConnection.signalingState !== "closed") {
            console.warn("⚠️ Ya existe una conexión activa. Ignorando nueva oferta.");
            return;
        }

        console.log("🔵 Creando nueva conexión WebRTC...");
        peerConnection = new RTCPeerConnection(iceServers);

        peerConnection.ontrack = (event) => {
            console.log("✅ Stream recibido:", event.streams[0]);
            remoteVideo.srcObject = event.streams[0];

            setTimeout(() => {
                if (remoteVideo.srcObject !== event.streams[0]) {
                    console.warn("⚠️ Volviendo a asignar el stream al remoteVideo...");
                    remoteVideo.srcObject = event.streams[0];
                }
                remoteVideo.play().catch(error => {
                    console.warn("⚠️ No se pudo reproducir automáticamente:", error);
                    playVideoButton.style.display = "inline-block"; // Mostrar el botón si la reproducción falla
                });
            }, 500);
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("📌 Enviando ICE Candidate...");
                signalingChannel.postMessage({ type: 'candidate', candidate: event.candidate.toJSON() });
            }
        };

        console.log("🔵 Aplicando setRemoteDescription(offer)");
        await peerConnection.setRemoteDescription(new RTCSessionDescription(event.data.offer));

        // Aplicar ICE Candidates almacenados en buffer
        while (iceCandidatesBuffer.length > 0) {
            let candidate = iceCandidatesBuffer.shift();
            console.log("✅ Aplicando ICE Candidate del buffer:", candidate);
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        signalingChannel.postMessage({ type: 'answer', answer });

    } else if (event.data.type === 'answer') {
        console.log("🟢 Aplicando setRemoteDescription(answer)");
        if (peerConnection.signalingState !== "stable") {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(event.data.answer));
        } else {
            console.warn("⚠️ La conexión ya está en estado 'stable', ignorando answer.");
        }

    } else if (event.data.type === 'candidate') {
        console.log("📌 Agregando ICE Candidate...");
        if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(event.data.candidate));
        } else {
            console.warn("⚠️ ICE Candidate recibido antes de setRemoteDescription(). Guardando en buffer.");
            iceCandidatesBuffer.push(event.data.candidate);
        }
    }
};

startSharingButton.addEventListener('click', startScreenSharing);

