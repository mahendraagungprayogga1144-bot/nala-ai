//+------------------------------------------------------------------
//| GercepTradeExecutor.mq5
//| Poll Gercep Trading AI Brain signal and execute on DEMO only.
//|
//| Hard rules enforced in EA:
//|  - MAX_POSITION = 1 (magic-filtered)
//|  - NO_AVERAGING / NO_MARTINGALE / NO_GRID / NO_HEDGE
//|  - LIVE account blocked when InpRequireDemo=true (default)
//|  - Orders OFF until InpAllowTrading=true
//|  - Also requires server eaMayExecute (TRADING_AI_EA_SIGNALS=1)
//|  - Also requires server serverExecutable=true (server demo-only gate)
//|
//| Setup:
//|  1. Keep GercepCandlePush.mq5 running (candle feed)
//|  2. Set InpBaseUrl + InpApiKey (gea_...)
//|  3. MT5 → Allow WebRequest for base URL
//|  4. Attach to XAUUSD, Algo Trading ON
//|  5. Set InpAllowTrading=true only after feed+signal look correct
//+------------------------------------------------------------------
#property copyright "Gercep AI"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

input string InpBaseUrl      = "https://www.gercepos.id"; // MUST use www (bare domain 308-redirects)
input string InpApiKey       = "gea_PASTE_YOUR_KEY";
input string InpSymbol       = "XAUUSD";
input int    InpMagic        = 26080701;
input int    InpPollSec      = 15;
input double InpLotFallback  = 0.01;
input bool   InpAllowTrading = false; // MUST flip manually
input bool   InpRequireDemo  = true;  // hard block live by default
input int    InpSlippagePts  = 30;
input int    InpMinConfidence= 65;

CTrade trade;
string g_lastSignalId = "";

string SignalUrl(const string qs)
{
   return InpBaseUrl + "/api/trading-ai/signal?" + qs;
}

string EscapeUrl(const string s)
{
   // minimal encoding for digits/letters/.-_
   return s;
}

bool IsDemoAccount()
{
   long mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   return (mode == ACCOUNT_TRADE_MODE_DEMO);
}

//| Reported to server as account_mode. Server only marks a signal
//| executable when this is exactly "demo".
string AccountModeString()
{
   long mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(mode == ACCOUNT_TRADE_MODE_DEMO)    return "demo";
   if(mode == ACCOUNT_TRADE_MODE_CONTEST) return "contest";
   if(mode == ACCOUNT_TRADE_MODE_REAL)    return "real";
   return "unknown";
}

int CountOurPositions()
{
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(PositionGetString(POSITION_SYMBOL) != InpSymbol) continue;
      n++;
   }
   return n;
}

bool SelectOurPosition(ulong &ticket, long &type, double &price, double &lot, double &sl, double &tp, double &pnl)
{
   ticket = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(!PositionSelectByTicket(t)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;
      if(PositionGetString(POSITION_SYMBOL) != InpSymbol) continue;
      ticket = t;
      type = PositionGetInteger(POSITION_TYPE);
      price = PositionGetDouble(POSITION_PRICE_OPEN);
      lot = PositionGetDouble(POSITION_VOLUME);
      sl = PositionGetDouble(POSITION_SL);
      tp = PositionGetDouble(POSITION_TP);
      pnl = PositionGetDouble(POSITION_PROFIT);
      return true;
   }
   return false;
}

string ExtractJsonString(const string json, const string key)
{
   string needle = "\"" + key + "\":\"";
   int p = StringFind(json, needle);
   if(p < 0) return "";
   int start = p + StringLen(needle);
   int end = StringFind(json, "\"", start);
   if(end < 0) return "";
   return StringSubstr(json, start, end - start);
}

bool ExtractJsonBool(const string json, const string key, const bool def)
{
   string needle = "\"" + key + "\":";
   int p = StringFind(json, needle);
   if(p < 0) return def;
   int start = p + StringLen(needle);
   while(start < StringLen(json) && StringGetCharacter(json, start) == ' ') start++;
   if(StringFind(json, "true", start) == start) return true;
   if(StringFind(json, "false", start) == start) return false;
   return def;
}

double ExtractJsonNumber(const string json, const string key, const double def)
{
   string needle = "\"" + key + "\":";
   int p = StringFind(json, needle);
   if(p < 0) return def;
   int start = p + StringLen(needle);
   while(start < StringLen(json))
   {
      ushort ch = (ushort)StringGetCharacter(json, start);
      if(ch == ' ' || ch == '\t') { start++; continue; }
      break;
   }
   if(StringFind(json, "null", start) == start) return def;
   string num = "";
   for(int i = start; i < StringLen(json); i++)
   {
      ushort ch = (ushort)StringGetCharacter(json, i);
      if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-' || ch == '+')
         num += ShortToString(ch);
      else
         break;
   }
   if(num == "") return def;
   return StringToDouble(num);
}

bool HttpGet(const string url, string &body)
{
   char data[];
   char result[];
   string headers = "Authorization: Bearer " + InpApiKey + "\r\n";
   string result_headers;
   int code = WebRequest("GET", url, headers, 8000, data, result, result_headers);
   if(code == -1)
   {
      Print("Gercep signal WebRequest failed. Err=", GetLastError(),
            " — allow URL: ", InpBaseUrl);
      return false;
   }
   body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code < 200 || code >= 300)
   {
      Print("Gercep signal HTTP ", code, " ", body);
      return false;
   }
   return true;
}

bool CloseOurPosition()
{
   ulong ticket; long type; double price, lot, sl, tp, pnl;
   if(!SelectOurPosition(ticket, type, price, lot, sl, tp, pnl)) return true;
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpSlippagePts);
   if(!trade.PositionClose(ticket))
   {
      Print("Close failed ticket=", ticket, " ret=", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
      return false;
   }
   Print("Closed ticket=", ticket);
   return true;
}

bool OpenSide(const string decision, const double lot, const double sl, const double tp)
{
   if(CountOurPositions() > 0)
   {
      Print("MAX_POSITION=1 — skip new entry");
      return false;
   }
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpSlippagePts);
   trade.SetTypeFillingBySymbol(InpSymbol);

   double volume = lot;
   if(volume <= 0) volume = InpLotFallback;
   double minLot = SymbolInfoDouble(InpSymbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(InpSymbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(InpSymbol, SYMBOL_VOLUME_STEP);
   if(step <= 0) step = 0.01;
   volume = MathMax(minLot, MathMin(maxLot, volume));
   volume = MathFloor(volume / step + 1e-9) * step;

   bool ok = false;
   if(decision == "BUY")
      ok = trade.Buy(volume, InpSymbol, 0, sl, tp, "Gercep Brain BUY");
   else if(decision == "SELL")
      ok = trade.Sell(volume, InpSymbol, 0, sl, tp, "Gercep Brain SELL");
   else
      return false;

   if(!ok)
      Print("Open ", decision, " failed ret=", trade.ResultRetcode(), " ", trade.ResultRetcodeDescription());
   else
      Print("Opened ", decision, " lot=", volume, " sl=", sl, " tp=", tp);
   return ok;
}

void PollAndAct()
{
   if(StringFind(InpApiKey, "gea_") != 0)
   {
      Print("Set InpApiKey (gea_...) from Gercep dashboard.");
      return;
   }

   if(InpRequireDemo && !IsDemoAccount())
   {
      Print("LIVE account blocked — InpRequireDemo=true (demo only).");
      return;
   }

   double bid = SymbolInfoDouble(InpSymbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(InpSymbol, SYMBOL_ASK);
   double point = SymbolInfoDouble(InpSymbol, SYMBOL_POINT);
   double spreadPts = (point > 0) ? (ask - bid) / point : 0;
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);

   string open_side = "none";
   string open_qs = "";
   ulong ticket; long type; double oprice, olot, osl, otp, opnl;
   if(SelectOurPosition(ticket, type, oprice, olot, osl, otp, opnl))
   {
      open_side = (type == POSITION_TYPE_BUY ? "BUY" : "SELL");
      open_qs =
         "&open_side=" + open_side +
         "&open_price=" + DoubleToString(oprice, 5) +
         "&open_lot=" + DoubleToString(olot, 2) +
         "&open_ticket=" + IntegerToString((long)ticket) +
         "&open_sl=" + DoubleToString(osl, 5) +
         "&open_tp=" + DoubleToString(otp, 5) +
         "&open_pnl=" + DoubleToString(opnl, 2);
   }

   string qs = StringFormat(
      "symbol=%s&account_mode=%s&bid=%.5f&ask=%.5f&spread=%.0f&balance=%.2f%s",
      InpSymbol, AccountModeString(), bid, ask, spreadPts, balance, open_qs
   );

   string body;
   if(!HttpGet(SignalUrl(qs), body)) return;

   string decision = ExtractJsonString(body, "decision");
   string signalId = ExtractJsonString(body, "signalId");
   bool eaMay = ExtractJsonBool(body, "eaMayExecute", false);
   bool srvExec = ExtractJsonBool(body, "serverExecutable", false);
   double confidence = ExtractJsonNumber(body, "confidence", 0);
   double lot = ExtractJsonNumber(body, "lot", InpLotFallback);
   double sl = ExtractJsonNumber(body, "stopLoss", 0);
   double tp = ExtractJsonNumber(body, "takeProfit", 0);

   Print("Signal id=", signalId, " decision=", decision,
         " conf=", confidence, " srvExec=", srvExec, " eaMay=", eaMay,
         " mode=", AccountModeString(), " allow=", InpAllowTrading);

   if(signalId != "" && signalId == g_lastSignalId)
      return; // de-dupe identical id

   if(decision == "" || decision == "WAIT")
   {
      g_lastSignalId = signalId;
      return;
   }

   if(!InpAllowTrading)
   {
      Print("Trading disabled (InpAllowTrading=false). Signal not executed.");
      g_lastSignalId = signalId;
      return;
   }

   if(!eaMay)
   {
      Print("Server eaMayExecute=false — set TRADING_AI_EA_SIGNALS=1 on Gercep host.");
      g_lastSignalId = signalId;
      return;
   }

   // Server-side demo gate. Independent from InpRequireDemo above:
   // both must agree before any OrderSend.
   if(!srvExec)
   {
      Print("Server serverExecutable=false — signal advisory only. mode=", AccountModeString());
      g_lastSignalId = signalId;
      return;
   }

   // Belt and braces: never trade a non-demo account from this EA.
   if(!IsDemoAccount())
   {
      Print("Non-demo account detected at execution time — abort.");
      g_lastSignalId = signalId;
      return;
   }

   if(decision == "CLOSE")
   {
      CloseOurPosition();
      g_lastSignalId = signalId;
      return;
   }

   if(decision == "BUY" || decision == "SELL")
   {
      if(confidence < InpMinConfidence)
      {
         Print("Confidence below EA min — skip");
         g_lastSignalId = signalId;
         return;
      }
      if(CountOurPositions() > 0)
      {
         Print("Already in position — NO_AVERAGING / MAX_POSITION");
         g_lastSignalId = signalId;
         return;
      }
      double slv = (sl > 0 ? sl : 0);
      double tpv = (tp > 0 ? tp : 0);
      OpenSide(decision, lot, slv, tpv);
      g_lastSignalId = signalId;
   }
}

int OnInit()
{
   trade.SetExpertMagicNumber(InpMagic);
   EventSetTimer(MathMax(5, InpPollSec));
   Print("GercepTradeExecutor init. demoOnly=", InpRequireDemo,
         " allowTrading=", InpAllowTrading);
   PollAndAct();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   PollAndAct();
}

void OnTick()
{
   // timer-driven
}
