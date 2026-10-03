import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  formName?: string;
  reference?: string;
  fields?: { label: string; value: string }[];
}

function FormSubmission({ formName = "Website form", reference, fields = [] }: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>New submission: {formName}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif", color: "#1f2937" }}>
        <Container style={{ padding: "24px", maxWidth: "560px" }}>
          <Heading style={{ color: "#0b1f44", fontSize: "22px" }}>New submission: {formName}</Heading>
          {reference && <Text style={{ fontSize: "14px" }}>Reference: <strong>{reference}</strong></Text>}
          <Section style={{ borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
            {fields.map((f) => (
              <Text key={f.label} style={{ margin: "6px 0", fontSize: "14px" }}>
                <strong>{f.label}:</strong> {f.value || "—"}
              </Text>
            ))}
          </Section>
          <Text style={{ color: "#6b7280", fontSize: "12px", marginTop: "24px" }}>Sent automatically by the JAV Wireless website.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: FormSubmission,
  subject: (d: Record<string, any>) => `New ${d['formName'] ?? "form"} submission${d['reference'] ? ` — ${d['reference']}` : ""}`,
  displayName: "Form submission notification",
  to: "javwireless5@gmail.com",
  previewData: { formName: "Checkout order", reference: "JAV-1001", fields: [{ label: "Name", value: "Jane Doe" }, { label: "Email", value: "jane@example.com" }] },
} satisfies TemplateEntry;
