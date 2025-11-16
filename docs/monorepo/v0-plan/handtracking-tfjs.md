# @spatial-ui-kit/handtracking-tfjs – TF.js + MediaPipe wrapper

Goal v0: `createTFJSHandModel()` returning a usable HandModel with normalized landmarks.

- Create package skeleton
  - packages/handtracking-tfjs/package.json
  - Install deps:
    - @tensorflow-models/hand-pose-detection
    - @tensorflow/tfjs-core
    - @tensorflow/tfjs-converter
    - @tensorflow/tfjs-backend-webgl
    - @mediapipe/hands
  - src/index.ts
  - src/modelFactory.ts
  - src/mapping.ts
- Define HandModel interface
  - estimateHands(video: HTMLVideoElement): Promise<TrackedHand[]>
- Implement modelFactory.ts
  - Lazy singleton detector using hand-pose-detection
  - Support options: modelType, maxHands, solutionPath
- Implement mapping.ts
  - Function to map TF.js Hand[] → TrackedHand[]
  - Normalize x/y using video.videoWidth / video.videoHeight
  - Copy handedness
- Implement createTFJSHandModel
  - Await detector
  - Return HandModel with estimateHands(video) that:
    - Calls detector
    - Maps to TrackedHand[]
- Minimal tests
  - Type-level/compile tests
  - Manual test in sandbox app
