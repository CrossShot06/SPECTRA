import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as status;
import '../models/detection_result.dart';

enum WsConnectionState { disconnected, connecting, connected, error }

class WebSocketService {
  WebSocketChannel? _channel;
  final StreamController<DetectionResult> _resultController = StreamController<DetectionResult>.broadcast();
  final StreamController<WsConnectionState> _stateController = StreamController<WsConnectionState>.broadcast();

  Stream<DetectionResult> get results => _resultController.stream;
  Stream<WsConnectionState> get connectionState => _stateController.stream;

  bool _isDisposed = false;

  void connect(String wsUrl) {
    if (_isDisposed) return;
    _stateController.add(WsConnectionState.connecting);

    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _stateController.add(WsConnectionState.connected);

      _channel!.stream.listen(
        (data) {
          try {
            final decoded = jsonDecode(data as String) as Map<String, dynamic>;
            final result = DetectionResult.fromJson(decoded);
            _resultController.add(result);
          } catch (e) {
            // Handle malformed payloads without closing socket
          }
        },
        onError: (err) {
          _stateController.add(WsConnectionState.error);
        },
        onDone: () {
          _stateController.add(WsConnectionState.disconnected);
        },
        cancelOnError: false,
      );
    } catch (e) {
      _stateController.add(WsConnectionState.error);
    }
  }

  void sendAudioChunk(Uint8List chunk) {
    if (_channel != null && _channel!.closeCode == null) {
      _channel!.sink.add(chunk);
    }
  }

  void disconnect() {
    _channel?.sink.close(status.normalClosure);
    _channel = null;
    _stateController.add(WsConnectionState.disconnected);
  }

  void dispose() {
    _isDisposed = true;
    disconnect();
    _resultController.close();
    _stateController.close();
  }
}