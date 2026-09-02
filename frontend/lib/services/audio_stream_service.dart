import 'dart:async';
import 'dart:typed_data';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

class AudioStreamService {
  final AudioRecorder _recorder = AudioRecorder();
  StreamSubscription<Uint8List>? _recordSubscription;
  final StreamController<Uint8List> _chunkController = StreamController<Uint8List>.broadcast();

  // 16kHz * 16-bit (2 bytes) * 1 channel (mono) = 32,000 bytes/sec
  // 500ms window = 16,000 bytes
  static const int kChunkTargetBytes = 16000;
  final BytesBuilder _buffer = BytesBuilder(copy: false);

  Stream<Uint8List> get audioStream => _chunkController.stream;

  Future<bool> initializeAndStart() async {
    final status = await Permission.microphone.request();
    if (status != PermissionStatus.granted) {
      return false;
    }

    final hasPermission = await _recorder.hasPermission();
    if (!hasPermission) return false;

    const config = RecordConfig(
      encoder: AudioEncoder.pcm16bits,
      sampleRate: 16000,
      numChannels: 1,
      autoGain: true,
      echoCancel: true,
      noiseSuppress: true,
    );

    final stream = await _recorder.startStream(config);
    _buffer.clear();

    _recordSubscription = stream.listen(
      (chunk) {
        _buffer.add(chunk);
        if (_buffer.length >= kChunkTargetBytes) {
          final completeBytes = _buffer.takeBytes();
          _chunkController.add(Uint8List.fromList(completeBytes));
        }
      },
      onError: (error) {
        _chunkController.addError(error);
      },
      cancelOnError: false,
    );

    return true;
  }

  Future<void> stop() async {
    await _recordSubscription?.cancel();
    _recordSubscription = null;
    if (await _recorder.isRecording()) {
      await _recorder.stop();
    }
    _buffer.clear();
  }

  void dispose() {
    stop();
    _recorder.dispose();
    _chunkController.close();
  }
}