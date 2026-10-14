import { Camera, CameraOff, Keyboard, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Field, Input } from '@/components/ui';
import { getState } from '@/data/store';

type Status = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied';

interface DetectorLike {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

/**
 * Software barcode scanning: webcam (native BarcodeDetector, falling back to ZXing loaded on demand),
 * USB keyboard-wedge scanners (they type the code + Enter into the focused field) and manual entry.
 * Existing product → product page. Unknown code → Add Product with the barcode pre-filled.
 */
export function useBarcodeRouting() {
  const navigate = useNavigate();
  return (code: string) => {
    const c = code.trim();
    if (!c) return;
    const p = getState().products.find((x) => x.barcode === c || x.sku.toLowerCase() === c.toLowerCase());
    navigate(p ? `/products/${p.id}` : `/inventory?new=1&barcode=${encodeURIComponent(c)}`);
  };
}

export function CameraScanner({ onCode, active }: { onCode: (code: string) => void; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const stopRef = useRef<() => void>(() => undefined);

  useEffect(() => () => stopRef.current(), []);
  useEffect(() => {
    if (!active) stopRef.current();
  }, [active]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unsupported');
    setStatus('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      return setStatus('denied');
    }
    const v = video.current!;
    v.srcObject = stream;
    await v.play();
    setStatus('scanning');
    let stopped = false;
    stopRef.current = () => {
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      setStatus('idle');
    };
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
    if (BD) {
      const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });
      const tick = async () => {
        if (stopped) return;
        try {
          const r = await det.detect(v);
          if (r[0]?.rawValue) {
            stopRef.current();
            return onCode(r[0].rawValue);
          }
        } catch {
          /* frame not ready */
        }
        window.setTimeout(tick, 250);
      };
      tick();
    } else {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoElement(v, (res) => {
        if (res && !stopped) {
          controls.stop();
          stopRef.current();
          onCode(res.getText());
        }
      });
      const prev = stopRef.current;
      stopRef.current = () => {
        controls.stop();
        prev();
      };
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-ink/[.04]">
      <video ref={video} className={status === 'scanning' ? 'aspect-[4/3] w-full object-cover' : 'hidden'} muted playsInline />
      {status === 'scanning' && (
        <>
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-[2px] -translate-y-1/2 animate-pulse bg-brand shadow-[0_0_14px_#ff8a00]" />
          <Button size="sm" className="absolute bottom-3 right-3" onClick={() => stopRef.current()}>
            <CameraOff size={14} /> Stop camera
          </Button>
        </>
      )}
      {status !== 'scanning' && (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-ink-2">
            <ScanLine size={26} />
          </div>
          <p className="text-sm text-ink-2">
            {status === 'denied' && 'Camera permission was denied. Allow camera access in the browser, or type / scan the code below.'}
            {status === 'unsupported' && 'This browser cannot open a camera. Use a USB scanner or type the code below.'}
            {(status === 'idle' || status === 'starting') && 'Point the camera at a barcode. Works with EAN, UPC, Code 128 and QR.'}
          </p>
          <Button variant="dark" size="sm" onClick={start} loading={status === 'starting'}>
            <Camera size={14} /> Start camera
          </Button>
        </div>
      )}
    </div>
  );
}

export function ScannerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const route = useBarcodeRouting();
  const [code, setCode] = useState('');
  const done = (c: string) => {
    onOpenChange(false);
    setCode('');
    route(c);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Scan a barcode" description="Existing products open their details. New barcodes open the Add Product form.">
      <div className="space-y-4">
        {open && <CameraScanner active={open} onCode={done} />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            done(code);
          }}
        >
          <Field label="USB scanner or manual entry" hint="Keep this field focused and scan — USB scanners type the code and press Enter." htmlFor="scan-input">
            <div className="flex gap-2">
              <Input id="scan-input" autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 8901262150125" />
              <Button type="submit" variant="primary">
                <Keyboard size={15} /> Find
              </Button>
            </div>
          </Field>
        </form>
      </div>
    </Dialog>
  );
}
