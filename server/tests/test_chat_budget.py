import unittest

from server.chat_budget import chat_budget, chat_workload, compact_history, requested_style


class ChatBudgetTests(unittest.TestCase):
  def test_documents_keep_the_full_output_budget_in_fast_mode(self):
    self.assertEqual(chat_workload("Vytvoř tři poznámky s Mermaid diagramy", "assist"), "document")
    self.assertEqual(chat_budget("document", "fast").output_tokens, 6144)
    self.assertEqual(chat_workload("Vytvoř poznámku", "read"), "vault")
    self.assertEqual(chat_workload("Přesuň poznámku do Lab", "agent"), "vault")
    self.assertEqual(chat_workload("Doplň do všech tří diagram", "assist", ["Vytvoř tři poznámky"]), "document")
    self.assertEqual(chat_workload("Napiš MD o TLS", "assist"), "document")
    self.assertEqual(requested_style("Vysvětli podrobně TLS", "fast"), "detailed")

  def test_fast_chat_has_a_smaller_budget_than_detailed_chat(self):
    fast = chat_budget("chat", "fast")
    detailed = chat_budget("chat", "detailed")
    self.assertLess(fast.context_chars, detailed.context_chars)
    self.assertLess(fast.history_chars, detailed.history_chars)
    self.assertLess(fast.output_tokens, detailed.output_tokens)

  def test_latest_request_is_never_cut_even_if_it_exceeds_the_history_budget(self):
    latest = {"role": "user", "content": "Z" * 20000}
    self.assertEqual(compact_history([{"role": "assistant", "content": "older"}, latest], chat_budget("chat", "fast")), [latest])

  def test_partial_history_is_marked_and_within_the_character_budget(self):
    messages = [{"role": "assistant", "content": "old" * 3000}, {"role": "user", "content": "latest"}]
    selected = compact_history(messages, chat_budget("chat", "fast"))
    self.assertEqual(selected[-1], messages[-1])
    self.assertIn("ZKRÁCENÁ HISTORIE", selected[0]["content"])
    self.assertLessEqual(sum(len(item["content"]) for item in selected), 3000)

  def test_many_small_messages_keep_only_the_recent_turns(self):
    messages = [{"role": "user", "content": str(index)} for index in range(30)]
    selected = compact_history(messages, chat_budget("chat", "fast"))
    self.assertEqual(selected, messages[-8:])
