-- بازی سنگ کاغذ قیچی
CREATE TABLE IF NOT EXISTS rock_paper_scissors_games (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  player1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_round INTEGER DEFAULT 1,
  max_rounds INTEGER DEFAULT 3,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- راندهای بازی
CREATE TABLE IF NOT EXISTS game_rounds (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES rock_paper_scissors_games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  player1_choice VARCHAR(10),
  player2_choice VARCHAR(10),
  result VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE(game_id, round_number)
);

-- ایندکس‌ها برای عملکرد بهتر
CREATE INDEX IF NOT EXISTS idx_rps_games_chat_id ON rock_paper_scissors_games(chat_id);
CREATE INDEX IF NOT EXISTS idx_rps_games_status ON rock_paper_scissors_games(status);
CREATE INDEX IF NOT EXISTS idx_game_rounds_game_id ON game_rounds(game_id);
