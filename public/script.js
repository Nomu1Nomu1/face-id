const video = document.getElementById('video');
const span = document.getElementsByClassName('close')[0];
const nameInput = document.getElementById('nameInput');
const startButton = document.getElementById('startButton');

let isCapturing = false;

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('models/'),
    faceapi.nets.faceLandmark68Net.loadFromUri('models/'),
    faceapi.nets.faceRecognitionNet.loadFromUri('models/'),
    faceapi.nets.faceExpressionNet.loadFromUri('models/')
])

setTimeout(() => {
    startVideo();
}, 1000);

function startVideo() {
    navigator.getUserMedia(
        { video: {} },
        stream => video.srcObject = stream,
        err => console.error(err)
    );

    video.addEventListener('play', async () => {
        const canvas = faceapi.createCanvasFromMedia(video);
        canvas.style.width = '700px';
        canvas.style.height = '600px';
        canvas.style.position = 'absolute';
        document.body.append(canvas);
        const displaySize = { width: 400, height: 400 };
        faceapi.matchDimensions(canvas, displaySize);

        const interval = setInterval(async () => {
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            const response = await fetch('/should-capture');
            const shouldCapture = await response.json();

            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);

            if (detections.length > 0 && shouldCapture.capture && !isCapturing) {
                captureImage();
            }
        }, 1000);
    });
}


function captureImage() {
    isCapturing = true;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    navigator.geolocation.getCurrentPosition(
        position => {
            
        }
    )

    canvas.toBlob(blob => {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}.png`;

        const formData = new FormData();
        formData.append('image', blob, filename);
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            if(data.face_found_in_image) {
                data.face_names.forEach(name => {
                    console.log(name);
                    const toastLiveExample = document.getElementById('liveToast');
                    const toast = new bootstrap.Toast(toastLiveExample);
                    toast.show();
                    const nameSpan = document.getElementById('nameSpan');
                    nameSpan.textContent = name.name;
                });
            }
            isCapturing = false;
        })
        .catch(error => {
            console.error('Error:', error);
            isCapturing = false;
        });
    }, 'image/png');
}
