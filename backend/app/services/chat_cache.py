# backend/app/services/chat_cache.py

from typing import Dict, Any

class ChatCache:
    def __init__(self):
        # A simple in-memory dictionary mapping user_id -> context dictionary
        self._cache: Dict[int, Any] = {}

    def get_context(self, user_id: int) -> Any:
        return self._cache.get(user_id)

    def set_context(self, user_id: int, context: Any):
        self._cache[user_id] = context

    def clear_context(self, user_id: int):
        if user_id in self._cache:
            del self._cache[user_id]

# Singleton instance
chat_cache = ChatCache()
