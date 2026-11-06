#let raw-data = sys.inputs.at("data", default: "{}")
#let raw-options = sys.inputs.at("options", default: "{}")
#let signature-file = sys.inputs.at("signature", default: "")

#let data = json(bytes(raw-data))
#let options = json(bytes(raw-options))

#let lang = options.at("language", default: "de")
#let accent-hex = options.at("accentColor", default: "#14213D")
#let accent = rgb(accent-hex)
#let font-name = options.at("font", default: "Liberation Sans")
#let show-marks = options.at("includeFoldMarks", default: true)

#let is-en = lang == "en"
#let t(de, en) = if is-en { en } else { de }

#set document(
  title: data.at("subject", default: t("Anschreiben", "Cover Letter")),
  author: data.at("senderName", default: "")
)

#set page(
  paper: "a4",
  margin: (top: 20mm, bottom: 20mm, left: 25mm, right: 20mm),
  header: none,
  footer: none,
  background: {
    if show-marks {
      // DIN 5008 Form B fold mark 1 (105mm)
      place(top + left, dx: 5mm, dy: 105mm, line(length: 4mm, stroke: 0.35pt + rgb("#94a3b8")))
      // DIN 5008 punch mark (148.5mm)
      place(top + left, dx: 5mm, dy: 148.5mm, line(length: 6mm, stroke: 0.45pt + rgb("#94a3b8")))
      // DIN 5008 Form B fold mark 2 (210mm)
      place(top + left, dx: 5mm, dy: 210mm, line(length: 4mm, stroke: 0.35pt + rgb("#94a3b8")))
    }
  }
)

#set text(
  font: (font-name, "Liberation Sans", "DejaVu Sans", "Arial"),
  size: 10.5pt,
  fill: rgb("#1e293b"),
  lang: lang
)

#set par(justify: true, leading: 0.72em)

// ==========================================
// 1. Sender Header (Briefkopf oben)
// ==========================================
#let sender-name = data.at("senderName", default: "")
#let sender-street = data.at("senderStreet", default: "")
#let sender-postal = data.at("senderPostalCode", default: "")
#let sender-city = data.at("senderCity", default: "")
#let sender-phone = data.at("senderPhone", default: "")
#let sender-email = data.at("senderEmail", default: "")

#grid(
  columns: (1fr, auto),
  align: (left + top, right + top),
  [
    #if sender-name != "" [
      #text(size: 16pt, weight: "bold", fill: accent)[#sender-name]
    ]
  ],
  [
    #set text(size: 8pt, fill: rgb("#64748b"))
    #let contact-parts = ()
    #if sender-street != "" { contact-parts.push(sender-street) }
    #if sender-postal != "" or sender-city != "" {
      contact-parts.push(sender-postal + " " + sender-city)
    }
    #if sender-phone != "" { contact-parts.push(sender-phone) }
    #if sender-email != "" { contact-parts.push(sender-email) }
    #for (idx, item) in contact-parts.enumerate() [
      #item
      #if idx < contact-parts.len() - 1 [ \ ]
    ]
  ]
)

#v(8mm)

// ==========================================
// 2. DIN 5008 Address Field (Anschriftfeld) & Date Line
// ==========================================
#let recipient-company = data.at("recipientCompany", default: "")
#let recipient-dept = data.at("recipientDepartment", default: "")
#let recipient-contact = data.at("recipientContactPerson", default: "")
#let recipient-street = data.at("recipientStreet", default: "")
#let recipient-postal = data.at("recipientPostalCode", default: "")
#let recipient-city = data.at("recipientCity", default: "")
#let recipient-country = data.at("recipientCountry", default: "")

#let place-name = data.at("place", default: "")
#let letter-date = data.at("date", default: "")

// Build return address line (Rücksendeangabe)
#let return-address-parts = ()
#if sender-name != "" { return-address-parts.push(sender-name) }
#if sender-street != "" { return-address-parts.push(sender-street) }
#if sender-postal != "" or sender-city != "" {
  return-address-parts.push(sender-postal + " " + sender-city)
}
#let return-address-line = return-address-parts.join(" · ")

#grid(
  columns: (85mm, 1fr),
  gutter: 15mm,
  align: (left + top, right + bottom),
  [
    // Return address for window envelope (max 5mm high, 7-8pt)
    #block(width: 85mm)[
      #text(size: 7.5pt, fill: rgb("#64748b"))[#return-address-line]
      #v(1.5mm)
      #line(length: 85mm, stroke: 0.35pt + rgb("#cbd5e1"))
    ]
    #v(2.5mm)

    // Recipient address zone (max 6-7 lines)
    #block(width: 85mm)[
      #set text(size: 10pt, fill: rgb("#0f172a"))
      #if recipient-company != "" [ #text(weight: "medium")[#recipient-company] \ ]
      #if recipient-dept != "" [ #recipient-dept \ ]
      #if recipient-contact != "" [ #recipient-contact \ ]
      #if recipient-street != "" [ #recipient-street \ ]
      #if recipient-postal != "" or recipient-city != "" [
        #(recipient-postal + " " + recipient-city) \
      ]
      #if recipient-country != "" and recipient-country != "Deutschland" and recipient-country != "Germany" [
        #recipient-country \
      ]
    ]
  ],
  [
    // Date line, right aligned
    #set text(size: 10pt, fill: rgb("#334155"))
    #let date-str = (
      if place-name != "" and letter-date != "" {
        place-name + ", " + letter-date
      } else if letter-date != "" {
        letter-date
      } else if place-name != "" {
        place-name
      } else {
        ""
      }
    )
    #if date-str != "" [
      #date-str
    ]
  ]
)

#v(8mm)

// ==========================================
// 3. Subject Line (Betreff nach DIN 5008: bold, no "Betreff:" prefix)
// ==========================================
#let subject-text = data.at("subject", default: "")
#if subject-text != "" [
  #block(width: 100%)[
    #text(size: 12pt, weight: "bold", fill: accent)[#subject-text]
  ]
  #v(5mm)
]

// ==========================================
// 4. Salutation (Anrede)
// ==========================================
#let salutation-text = data.at("salutation", default: "")
#if salutation-text != "" [
  #text(size: 10.5pt, weight: "medium", fill: rgb("#1e293b"))[#salutation-text]
  #v(3mm)
]

// ==========================================
// 5. Letter Body (Brieftext)
// ==========================================
#let body-text = data.at("body", default: "")
#if body-text != "" [
  #let paragraphs = body-text.split("\n\n")
  #for p in paragraphs [
    #let trimmed = p.trim()
    #if trimmed != "" [
      #let lines = trimmed.split("\n")
      #for (i, line-str) in lines.enumerate() [
        #line-str
        #if i < lines.len() - 1 [ \ ]
      ]
      #v(0.65em)
    ]
  ]
]

#v(3mm)

// ==========================================
// 6. Closing & Signature (Grußformel & Unterschrift)
// ==========================================
#let closing-text = data.at("closing", default: t("Mit freundlichen Grüßen", "Sincerely,"))
#block(breakable: false)[
  #text(size: 10.5pt, fill: rgb("#1e293b"))[#closing-text]
  #v(2mm)

  #if signature-file != "" [
    #image(signature-file, height: 18mm, fit: "contain")
    #v(1mm)
  ] else [
    #v(12mm)
  ]

  #let sig-name = data.at("signatureName", default: sender-name)
  #if sig-name != "" [
    #text(size: 10.5pt, weight: "medium", fill: rgb("#0f172a"))[#sig-name]
  ]
]

// ==========================================
// 7. Attachments Note (Anlagenvermerk)
// ==========================================
#let attachments-note = data.at("attachmentsNote", default: "")
#if attachments-note != "" [
  #v(8mm)
  #block(breakable: false)[
    #text(size: 9.5pt, weight: "bold", fill: rgb("#475569"))[#t("Anlagen", "Attachments")]
    #v(1mm)
    #text(size: 9pt, fill: rgb("#64748b"))[#attachments-note]
  ]
]
