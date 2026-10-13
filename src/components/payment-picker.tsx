import {
  CheckCircle2,
  CreditCard,
  Store,
  UploadCloud,
  Wallet,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { uploadZelleReceipt } from "@/lib/commerce.functions";

const options = [
  { id: "card", label: "Debit/credit card", icon: CreditCard },
  { id: "paypal", label: "PayPal", icon: Wallet },
  { id: "zelle", label: "Zelle", icon: Wallet },
] as const;

type PaymentPickerProps = {
  value: string;
  onChange: (v: string) => void;
  reference: string;
  onReference: (v: string) => void;
  allowStore?: boolean | undefined;
  amount?: string | undefined;
};

export function PaymentPicker({
  value,
  onChange,
  reference,
  onReference,
  allowStore,
  amount,
}: PaymentPickerProps) {
  const uploadReceipt = useServerFn(uploadZelleReceipt);

  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [fileName, setFileName] = useState("");

  const list = allowStore
    ? [
        ...options,
        { id: "store", label: "Pay in store", icon: Store } as const,
      ]
    : options;

  async function handleReceipt(file?: File) {
    setFileError("");

    if (!file) {
      setFileName("");
      onReference("");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFileError("Use a JPG, PNG or WebP image.");
      setFileName("");
      onReference("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError("The image must be 5 MB or smaller.");
      setFileName("");
      onReference("");
      return;
    }

    setUploading(true);
    setFileName("");
    onReference("");

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());

      let binary = "";

      for (let i = 0; i < buffer.length; i += 0x8000) {
        binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
      }

      const result = await uploadReceipt({
        data: {
          contentType: file.type as
            | "image/jpeg"
            | "image/png"
            | "image/webp",
          base64: btoa(binary),
        },
      });

      onReference(result.url);
      setFileName(file.name);
    } catch (error) {
      console.error(error);
      setFileError("We couldn’t upload the receipt. Please try again.");
      setFileName("");
      onReference("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-semibold transition ${
              value === option.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input
              type="radio"
              name="payment"
              className="sr-only"
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />

            <option.icon className="size-5" />
            {option.label}
          </label>
        ))}
      </div>

      {value === "card" && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          You’ll be redirected to Stripe’s secure payment page to enter your
          card. JAV Wireless never stores your card details.
        </p>
      )}

      {value === "paypal" && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          You’ll be redirected to PayPal to approve your payment securely.
        </p>
      )}

      {value === "zelle" && (
        <div className="space-y-5 rounded-xl border border-border bg-surface p-4 sm:p-6">
          <div className="text-center">
            <p className="text-sm font-semibold text-muted-foreground">
              Amount to send
            </p>

            <p className="mt-1 font-display text-3xl font-bold text-primary">
              {amount || "Your total"}
            </p>
          </div>

          <div className="mx-auto max-w-[300px]">
            <img
              src="/zelle-qr.png"
              alt="JAV Wireless Zelle QR code"
              className="w-full rounded-xl border border-border bg-white"
            />
          </div>

          <div className="text-center">
            <p className="font-bold text-primary">Scan to pay with Zelle</p>

            <p className="mt-2 font-semibold text-foreground">
              JAVWIRELESSNY.COM, LLC
            </p>

            <p className="text-muted-foreground">(646) 575-4597</p>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-xs font-semibold text-destructive">
            IMPORTANT: Do not write “money transfer” in the registration or
            payment comment.
          </div>

          <div className="border-t border-border pt-5">
            <label className="grid gap-2 text-sm font-semibold">
              Upload Zelle payment receipt *

              <div className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-background p-4 transition hover:border-primary">
                <UploadCloud className="size-5 text-primary" />

                <span>
                  {uploading ? "Uploading..." : "Choose payment receipt"}
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  required={!reference}
                  onChange={(e) => {
                    void handleReceipt(e.target.files?.[0]);
                  }}
                />
              </div>
            </label>

            <p className="mt-2 text-xs text-muted-foreground">
              JPG, PNG or WebP · Maximum 5 MB
            </p>

            {fileName && reference && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm font-semibold text-success">
                <CheckCircle2 className="size-5" />
                Receipt uploaded: {fileName}
              </div>
            )}

            {fileError && (
              <p className="mt-3 text-sm font-semibold text-destructive">
                {fileError}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            JAV Wireless will verify your payment before processing your
            request.
          </p>
        </div>
      )}

      {value === "store" && (
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          You’ll pay when you visit the store. Your request will be saved with
          a reference number.
        </p>
      )}
    </div>
  );
}