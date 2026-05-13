import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/http/dio_provider.dart';
import '../data/sources_repository.dart';
import '../domain/source_account_view.dart';

final sourcesRepositoryProvider = Provider<SourcesRepository>((ref) {
  return SourcesRepository(ref.watch(dioProvider));
});

final sourcesListProvider = FutureProvider<List<SourceAccountView>>((ref) {
  return ref.watch(sourcesRepositoryProvider).listSources();
});
