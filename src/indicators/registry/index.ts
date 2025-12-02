import { indicatorRegistry } from '../core/registry';
import { SMAIndicator } from './sma';
import { EMAIndicator } from './ema';
import { RSIIndicator } from './rsi';
import { BollingerBandsIndicator } from './bollinger';
import { VWAPIndicator } from './vwap';
import { StochasticIndicator } from './stochastic';
import { OBVIndicator } from './obv';
import { MFIIndicator } from './mfi';
import { ForceIndexIndicator } from './forceindex';
import { ATRIndicator } from './atr';
import { ADXIndicator } from './adx';
import { MACDIndicator } from './macd';
import { PSARIndicator } from './psar';
import { CCIIndicator } from './cci';
import { WilliamsRIndicator } from './williamsr';
import { KeltnerChannelsIndicator } from './keltner';
import { SuperTrendIndicator } from './supertrend';
import { IchimokuIndicator } from './ichimoku';
import { DonchianChannelsIndicator } from './donchian';
import { ROCIndicator } from './roc';
import { StochRSIIndicator } from './stochrsi';
import { WMAIndicator } from './wma';

export function registerBuiltInIndicators(): void {
  indicatorRegistry.register(SMAIndicator);
  indicatorRegistry.register(EMAIndicator);
  indicatorRegistry.register(RSIIndicator);
  indicatorRegistry.register(BollingerBandsIndicator);
  indicatorRegistry.register(VWAPIndicator);
  indicatorRegistry.register(StochasticIndicator);
  indicatorRegistry.register(OBVIndicator);
  indicatorRegistry.register(MFIIndicator);
  indicatorRegistry.register(ForceIndexIndicator);
  indicatorRegistry.register(ATRIndicator);
  indicatorRegistry.register(ADXIndicator);
  indicatorRegistry.register(MACDIndicator);
  indicatorRegistry.register(PSARIndicator);
  indicatorRegistry.register(CCIIndicator);
  indicatorRegistry.register(WilliamsRIndicator);
  indicatorRegistry.register(KeltnerChannelsIndicator);
  indicatorRegistry.register(SuperTrendIndicator);
  indicatorRegistry.register(IchimokuIndicator);
  indicatorRegistry.register(DonchianChannelsIndicator);
  indicatorRegistry.register(ROCIndicator);
  indicatorRegistry.register(StochRSIIndicator);
  indicatorRegistry.register(WMAIndicator);
}

export {
  SMAIndicator,
  EMAIndicator,
  RSIIndicator,
  BollingerBandsIndicator,
  VWAPIndicator,
  StochasticIndicator,
  OBVIndicator,
  MFIIndicator,
  ForceIndexIndicator,
  ATRIndicator,
  ADXIndicator,
  MACDIndicator,
  PSARIndicator,
  CCIIndicator,
  WilliamsRIndicator,
  KeltnerChannelsIndicator,
  SuperTrendIndicator,
  IchimokuIndicator,
  DonchianChannelsIndicator,
  ROCIndicator,
  StochRSIIndicator,
  WMAIndicator,
};
