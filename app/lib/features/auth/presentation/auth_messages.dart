import 'package:firebase_auth/firebase_auth.dart';

/// Mensajes en español para errores comunes de Firebase Auth.
String messageForFirebaseAuth(FirebaseAuthException e) {
  switch (e.code) {
    case 'invalid-email':
      return 'El correo no tiene un formato válido.';
    case 'user-disabled':
      return 'Esta cuenta está deshabilitada.';
    case 'user-not-found':
    case 'wrong-password':
    case 'invalid-credential':
      return 'Correo o contraseña incorrectos.';
    case 'email-already-in-use':
      return 'Ya existe una cuenta con este correo.';
    case 'weak-password':
      return 'La contraseña es demasiado débil (usa al menos 6 caracteres).';
    case 'operation-not-allowed':
      return 'El inicio de sesión con email no está habilitado en el proyecto.';
    case 'network-request-failed':
      return 'Sin conexión. Comprueba tu red e inténtalo de nuevo.';
    case 'too-many-requests':
      return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    default:
      return e.message?.trim().isNotEmpty == true ? e.message! : 'No se pudo completar la operación.';
  }
}
