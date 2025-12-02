import { indicatorRegistry } from '../core/registry';
import { SMAIndicator } from './sma';
import { EMAIndicator } from './ema';
import { RSIIndicator } from './rsi';
import { BollingerBandsIndicator } from './bollinger';
import { VWAPIndicator } from './vwap';

export function registerBuiltInIndicators(): void {
  indicatorRegistry.register(SMAIndicator);
  indicatorRegistry.register(EMAIndicator);
  indicatorRegistry.register(RSIIndicator);
  indicatorRegistry.register(BollingerBandsIndicator);
  indicatorRegistry.register(VWAPIndicator);
}

export { SMAIndicator, EMAIndicator, RSIIndicator, BollingerBandsIndicator, VWAPIndicator };
