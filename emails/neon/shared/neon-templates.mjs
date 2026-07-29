import { GPE_HUB_URL, GPE_WEBSITE_URL } from "./neon-email-tokens.mjs";

const p = (text, weight = false, mb = 18) =>
  `<p style="margin:0 0 ${mb}px;font-size:16px;line-height:1.7;${weight ? "font-weight:700;" : ""}color:#000000;">${text}</p>`;

const hubCard = `<div style="background-color:#cffafe;border:3px solid #000000;border-radius:20px;padding:18px;margin-top:24px;">
  <p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">
    The group chat is open
  </p>
  <p style="margin:0 0 14px;font-size:13px;line-height:1.6;font-weight:700;color:#000000;">
    The GPE Hub is a playful mission board for environmental justice opportunities, seasonal challenges, community conversations, and member connection.
  </p>
  <p style="margin:0;font-size:13px;line-height:1.6;color:#000000;">
    Watch your inbox for your Hub invitation or visit
    <a href="${GPE_HUB_URL}" style="font-weight:700;color:#000000;">members.girlplusenvironment.org</a>.
  </p>
</div>`;

const detailBox = (title, token) => `<div style="background-color:#fdf2f8;border:3px solid #000000;border-radius:20px;padding:18px;margin:0 0 24px;">
  <p style="margin:0 0 10px;font-family:Arial Black,Arial,sans-serif;font-size:16px;line-height:1.3;text-transform:uppercase;color:#000000;">${title}</p>
  <p style="margin:0;font-size:13px;line-height:1.7;font-weight:700;color:#000000;">${token}</p>
</div>`;

function template(group, file, config) {
  return {
    group,
    file,
    active: "unknown until reviewed in Neon",
    schedule: "unknown until reviewed in Neon",
    ...config
  };
}

export const neonTemplates = [
  template("membership", "membership-registration", {
    subject: "You can sit with us, girlie! 💖",
    heroSymbol: "💖",
    hero: "YOU CAN SIT WITH US",
    heroText: "Thanks for becoming a Girl Plus Environment member.",
    label: "Membership confirmed",
    heading: "WELCOME TO GPE",
    bodyHtml: p("You can sit with us, girlie!", true) + p("Thanks for becoming a GPE member, [[NEON_FIRST_NAME_TOKEN]].") + p("Your membership helps make space for black + brown femmes to lead this climate and environmental justice movement.", false, 28),
    button: { label: "View My Membership", url: "[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]" },
    secondaryHtml: hubCard,
    requiredBlockLabel: "Paste Neon membership details or receipt fields from the current Membership Registration template here.",
    tokens: ["[[NEON_FIRST_NAME_TOKEN]]", "[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]", "[[NEON_MEMBERSHIP_DETAILS_BLOCK]]"],
    text: "You can sit with us, girlie!\n\nThanks for becoming a GPE member, [[NEON_FIRST_NAME_TOKEN]].\nYour membership helps make space for black + brown femmes to lead this climate and environmental justice movement.\n\nView my membership:\n[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]"
  }),
  template("membership", "membership-registration-pay-later", {
    subject: "Your GPE membership is almost official 💖",
    heroSymbol: "💖",
    hero: "ALMOST OFFICIAL",
    heroText: "We saved your membership registration.",
    label: "Payment needed",
    heading: "ONE THING LEFT",
    bodyHtml: p("We received your GPE membership registration.", true) + p("Complete the payment below so we can activate your membership.", false, 28),
    button: { label: "Complete My Membership", url: "[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon payment, invoice, or membership balance fields from the current pay-later template here.",
    tokens: ["[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]", "[[NEON_PAYMENT_DETAILS_BLOCK]]"],
    text: "We received your GPE membership registration.\n\nComplete the payment below so we can activate your membership.\n\nComplete my membership:\n[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]"
  }),
  template("membership", "membership-renewal", {
    subject: "Still sitting with us 💖",
    heroSymbol: "💖",
    hero: "YOU’RE RENEWED",
    heroText: "Your GPE membership is active for another term.",
    label: "Membership renewed",
    heading: "GLAD YOU’RE STILL HERE",
    bodyHtml: p("Your GPE membership has been renewed.", true) + p("Thanks for continuing to make space with us.", false, 28),
    button: { label: "View My Membership", url: "[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon renewal term and receipt fields from the current renewal template here.",
    tokens: ["[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]", "[[NEON_MEMBERSHIP_DETAILS_BLOCK]]"],
    text: "Your GPE membership has been renewed.\n\nThanks for continuing to make space with us.\n\nView my membership:\n[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]"
  }),
  template("membership", "membership-renewal-pay-later", {
    subject: "Your renewal is almost done 💖",
    heroSymbol: "💖",
    hero: "ALMOST RENEWED",
    heroText: "Your GPE renewal needs one more step.",
    label: "Payment needed",
    heading: "FINISH YOUR RENEWAL",
    bodyHtml: p("We saved your membership renewal.", true) + p("Complete the payment below to keep your GPE membership active.", false, 28),
    button: { label: "Finish Renewal", url: "[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon renewal invoice or payment fields from the current renewal pay-later template here.",
    tokens: ["[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]", "[[NEON_PAYMENT_DETAILS_BLOCK]]"],
    text: "We saved your membership renewal.\n\nComplete the payment below to keep your GPE membership active.\n\nFinish renewal:\n[[NEON_MEMBERSHIP_PAYMENT_URL_TOKEN]]"
  }),
  template("membership", "membership-due", {
    subject: "Keep your seat with GPE 💖",
    heroSymbol: "💖",
    hero: "DON’T LOSE YOUR SEAT",
    heroText: "Your GPE membership is ready for renewal.",
    label: "Renewal due",
    heading: "STAY WITH US",
    bodyHtml: p("Your GPE membership is coming up for renewal.", true) + p("Renew below to keep your membership active.", false, 28),
    button: { label: "Renew My Membership", url: "[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon renewal due date, amount, and account fields from the current due notice here.",
    tokens: ["[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]", "[[NEON_MEMBERSHIP_DETAILS_BLOCK]]"],
    text: "Your GPE membership is coming up for renewal.\n\nRenew below to keep your membership active.\n\nRenew my membership:\n[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]"
  }),
  template("membership", "membership-overdue", {
    subject: "Girl, your membership needs attention 👀",
    heroSymbol: "👀",
    hero: "QUICK MEMBERSHIP CHECK",
    heroText: "Your renewal date has passed.",
    label: "Membership overdue",
    heading: "COME BACK TO THE TABLE",
    bodyHtml: p("Your GPE membership is currently overdue.", true) + p("Renew below to restore your active membership.", false, 28),
    button: { label: "Renew My Membership", url: "[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon overdue balance and renewal fields from the current overdue notice here.",
    tokens: ["[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]", "[[NEON_PAYMENT_DETAILS_BLOCK]]"],
    text: "Your GPE membership is currently overdue.\n\nRenew below to restore your active membership.\n\nRenew my membership:\n[[NEON_MEMBERSHIP_RENEWAL_URL_TOKEN]]"
  }),
  template("membership", "membership-auto-renewal-enabled", {
    subject: "Your GPE membership is set to renew 💖",
    heroSymbol: "💖",
    hero: "AUTO RENEWAL IS ON",
    heroText: "Your membership renewal is set up.",
    label: "Auto renewal",
    heading: "YOU’RE COVERED",
    bodyHtml: p("Your GPE membership is set to renew automatically.", true) + p("Keep this email for your records and review the details below.", false, 28),
    button: { label: "View My Membership", url: "[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon auto-renewal schedule, payment method, and membership fields here.",
    tokens: ["[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]", "[[NEON_RECURRING_SCHEDULE_BLOCK]]"],
    text: "Your GPE membership is set to renew automatically.\n\nView my membership:\n[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]"
  }),
  template("membership", "membership-auto-renewal-notice", {
    subject: "Your GPE membership renews soon",
    heroSymbol: "💖",
    hero: "RENEWAL COMING UP",
    heroText: "Your automatic renewal is coming soon.",
    label: "Renewal notice",
    heading: "HERE’S THE PLAN",
    bodyHtml: p("Your GPE membership is scheduled to renew soon.", true) + p("Review the renewal details below so there are no surprises.", false, 28),
    button: { label: "View My Membership", url: "[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon auto-renewal date, amount, payment method, and update-link fields here.",
    tokens: ["[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]", "[[NEON_RECURRING_SCHEDULE_BLOCK]]"],
    text: "Your GPE membership is scheduled to renew soon.\n\nView my membership:\n[[NEON_MEMBERSHIP_ACCOUNT_URL_TOKEN]]"
  }),
  template("membership", "membership-auto-renewal-error", {
    subject: "Your GPE renewal needs attention",
    heroSymbol: "👀",
    hero: "PAYMENT CHECK",
    heroText: "Your automatic renewal could not be completed.",
    label: "Payment issue",
    heading: "LET’S FIX IT",
    bodyHtml: p("Your GPE membership renewal payment did not go through.", true) + p("Update your payment information below to keep your membership active.", false, 28),
    button: { label: "Update Payment", url: "[[NEON_PAYMENT_UPDATE_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon payment error, retry, and account-management fields from the current template here.",
    tokens: ["[[NEON_PAYMENT_UPDATE_URL_TOKEN]]", "[[NEON_PAYMENT_DETAILS_BLOCK]]"],
    text: "Your GPE membership renewal payment did not go through.\n\nUpdate your payment information:\n[[NEON_PAYMENT_UPDATE_URL_TOKEN]]"
  }),
  template("events", "event-registration", {
    subject: "You’re on the list 💖",
    heroSymbol: "💖",
    hero: "SEE YOU THERE",
    heroText: "Your spot for [[NEON_EVENT_NAME_TOKEN]] is confirmed.",
    label: "Event registration",
    heading: "YOU’RE ON THE LIST",
    bodyHtml: p("We saved your spot for [[NEON_EVENT_NAME_TOKEN]].", true) + p("Keep this email nearby for the event details.", false, 28),
    button: { label: "View My Registration", url: "[[NEON_EVENT_REGISTRATION_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon event date, time, location, virtual link, ticket details, and registrant fields here.",
    tokens: ["[[NEON_EVENT_NAME_TOKEN]]", "[[NEON_EVENT_REGISTRATION_URL_TOKEN]]", "[[NEON_EVENT_DETAILS_BLOCK]]"],
    text: "We saved your spot for [[NEON_EVENT_NAME_TOKEN]].\n\nView my registration:\n[[NEON_EVENT_REGISTRATION_URL_TOKEN]]\n\n[[NEON_EVENT_DETAILS_BLOCK]]"
  }),
  template("events", "event-registration-pay-later", {
    subject: "Your event spot is almost set",
    heroSymbol: "🎤",
    hero: "ALMOST ON THE LIST",
    heroText: "Finish payment for [[NEON_EVENT_NAME_TOKEN]].",
    label: "Payment needed",
    heading: "ONE STEP LEFT",
    bodyHtml: p("We received your registration for [[NEON_EVENT_NAME_TOKEN]].", true) + p("Complete payment below to confirm your spot.", false, 28),
    button: { label: "Complete Registration", url: "[[NEON_EVENT_PAYMENT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon event payment, invoice, date, time, and registration fields here.",
    tokens: ["[[NEON_EVENT_NAME_TOKEN]]", "[[NEON_EVENT_PAYMENT_URL_TOKEN]]", "[[NEON_EVENT_DETAILS_BLOCK]]"],
    text: "We received your registration for [[NEON_EVENT_NAME_TOKEN]].\n\nComplete payment:\n[[NEON_EVENT_PAYMENT_URL_TOKEN]]"
  }),
  template("events", "event-reminder", {
    subject: "Girl, we’re almost live 👀",
    heroSymbol: "👀",
    hero: "SEE YOU SOON",
    heroText: "[[NEON_EVENT_NAME_TOKEN]] is coming up.",
    label: "Event reminder",
    heading: "HERE’S THE PLAN",
    bodyHtml: p("Just a reminder that [[NEON_EVENT_NAME_TOKEN]] is almost here.", true) + p("Check the details below and meet us there.", false, 28),
    button: { label: "View Event Details", url: "[[NEON_EVENT_LINK_TOKEN]]" },
    requiredBlockLabel: "Paste Neon event detail fields and use the existing join link or event details token.",
    tokens: ["[[NEON_EVENT_NAME_TOKEN]]", "[[NEON_EVENT_LINK_TOKEN]]", "[[NEON_EVENT_DETAILS_BLOCK]]"],
    text: "Just a reminder that [[NEON_EVENT_NAME_TOKEN]] is almost here.\n\nView event details:\n[[NEON_EVENT_LINK_TOKEN]]"
  }),
  template("events", "waitlist-confirmation", {
    subject: "You’re on the waitlist",
    heroSymbol: "💌",
    hero: "WAITLIST SAVED",
    heroText: "We saved your waitlist request.",
    label: "Waitlist",
    heading: "WE’LL KEEP WATCH",
    bodyHtml: p("You are on the waitlist for [[NEON_EVENT_NAME_TOKEN]].", true) + p("If a spot opens, Neon will send the next steps.", false, 28),
    requiredBlockLabel: "Paste Neon waitlist position, event details, and waitlist-management fields here.",
    tokens: ["[[NEON_EVENT_NAME_TOKEN]]", "[[NEON_WAITLIST_DETAILS_BLOCK]]"],
    text: "You are on the waitlist for [[NEON_EVENT_NAME_TOKEN]].\n\n[[NEON_WAITLIST_DETAILS_BLOCK]]"
  }),
  template("events", "notify-me", {
    subject: "We’ll let you know",
    heroSymbol: "💌",
    hero: "YOU’RE ON THE LIST",
    heroText: "We saved your event interest.",
    label: "Notify me",
    heading: "WE’LL SEND WORD",
    bodyHtml: p("We saved your request for updates about [[NEON_EVENT_NAME_TOKEN]].", true) + p("If details change or spots open, Neon will send the update.", false, 28),
    requiredBlockLabel: "Paste Neon notify-me confirmation fields from the current template here.",
    tokens: ["[[NEON_EVENT_NAME_TOKEN]]", "[[NEON_NOTIFY_ME_DETAILS_BLOCK]]"],
    text: "We saved your request for updates about [[NEON_EVENT_NAME_TOKEN]]."
  }),
  template("events", "attendee-confirmation", {
    subject: "You’re checked in 💖",
    heroSymbol: "🎤",
    hero: "YOU PULLED UP",
    heroText: "Thanks for joining [[NEON_EVENT_NAME_TOKEN]].",
    label: "Attendance confirmed",
    heading: "THANKS FOR COMING",
    bodyHtml: p("You were marked as attended for [[NEON_EVENT_NAME_TOKEN]].", true) + p("Keep this email for your records.", false, 28),
    requiredBlockLabel: "Paste Neon attendee confirmation and event record fields here.",
    tokens: ["[[NEON_EVENT_NAME_TOKEN]]", "[[NEON_ATTENDANCE_DETAILS_BLOCK]]"],
    text: "You were marked as attended for [[NEON_EVENT_NAME_TOKEN]]."
  }),
  template("events", "attendee-reminder", {
    subject: "Don’t forget to pull up",
    heroSymbol: "👀",
    hero: "EVENT CHECK",
    heroText: "[[NEON_EVENT_NAME_TOKEN]] is coming up.",
    label: "Attendee reminder",
    heading: "SEE YOU SOON",
    bodyHtml: p("[[NEON_EVENT_NAME_TOKEN]] is coming up soon.", true) + p("Check the details below before you head out or log on.", false, 28),
    button: { label: "View Event Details", url: "[[NEON_EVENT_LINK_TOKEN]]" },
    requiredBlockLabel: "Paste Neon attendee reminder date, time, location, and join-link fields here.",
    tokens: ["[[NEON_EVENT_NAME_TOKEN]]", "[[NEON_EVENT_LINK_TOKEN]]", "[[NEON_EVENT_DETAILS_BLOCK]]"],
    text: "[[NEON_EVENT_NAME_TOKEN]] is coming up soon.\n\n[[NEON_EVENT_DETAILS_BLOCK]]"
  }),
  template("events", "refund-release", {
    subject: "Your event refund was processed",
    heroSymbol: "💌",
    hero: "REFUND PROCESSED",
    heroText: "Your refund details are below.",
    label: "Refund",
    heading: "KEEP THIS FOR YOUR RECORDS",
    bodyHtml: p("Your refund for [[NEON_EVENT_NAME_TOKEN]] has been processed.", true) + p("Review the refund details below.", false, 28),
    requiredBlockLabel: "Paste Neon event refund amount, payment method, transaction, and legal fields here.",
    tokens: ["[[NEON_EVENT_NAME_TOKEN]]", "[[NEON_REFUND_DETAILS_BLOCK]]"],
    text: "Your refund for [[NEON_EVENT_NAME_TOKEN]] has been processed.\n\n[[NEON_REFUND_DETAILS_BLOCK]]"
  }),
  template("events", "exchange", {
    subject: "Your event registration was updated",
    heroSymbol: "💌",
    hero: "REGISTRATION UPDATED",
    heroText: "Your event exchange details are below.",
    label: "Exchange",
    heading: "HERE’S THE UPDATE",
    bodyHtml: p("Your event registration has been updated.", true) + p("Review the new details below.", false, 28),
    button: { label: "View My Registration", url: "[[NEON_EVENT_REGISTRATION_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon exchange details, old registration, new registration, and balance fields here.",
    tokens: ["[[NEON_EVENT_REGISTRATION_URL_TOKEN]]", "[[NEON_EXCHANGE_DETAILS_BLOCK]]"],
    text: "Your event registration has been updated.\n\nView my registration:\n[[NEON_EVENT_REGISTRATION_URL_TOKEN]]"
  }),
  template("donations", "donation-appreciation", {
    subject: "You just put resources behind the work 💖",
    heroSymbol: "💖",
    hero: "THANK YOU",
    heroText: "Your gift helps GPE make more room for black + brown femmes in climate.",
    label: "Donation received",
    heading: "YOU DID THAT",
    bodyHtml: p("Thank you for giving to Girl Plus Environment.", true) + p("Your gift helps us share resources and build more ways for our community to lead.", false, 28),
    button: { label: "Visit Girl Plus Environment", url: GPE_WEBSITE_URL },
    requiredBlockLabel: "Paste the full Neon receipt block here: gift amount, date, fund, payment method, transaction number, tax language, deductibility language, and organization details.",
    tokens: ["[[NEON_RECEIPT_BLOCK]]", "[[NEON_TRANSACTION_ID_TOKEN]]"],
    text: "Thank you for giving to Girl Plus Environment.\n\nYour gift helps us share resources and build more ways for our community to lead.\n\n[[NEON_RECEIPT_BLOCK]]"
  }),
  template("donations", "donation-appreciation-pay-later", {
    subject: "Your gift is almost complete",
    heroSymbol: "💖",
    hero: "ALMOST THERE",
    heroText: "We saved your donation pledge.",
    label: "Payment needed",
    heading: "FINISH YOUR GIFT",
    bodyHtml: p("We received your donation commitment.", true) + p("Complete payment below when you are ready.", false, 28),
    button: { label: "Complete My Gift", url: "[[NEON_DONATION_PAYMENT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon donation pay-later invoice, amount, fund, and tax language here.",
    tokens: ["[[NEON_DONATION_PAYMENT_URL_TOKEN]]", "[[NEON_RECEIPT_BLOCK]]"],
    text: "We received your donation commitment.\n\nComplete payment:\n[[NEON_DONATION_PAYMENT_URL_TOKEN]]"
  }),
  template("donations", "donation-anniversary", {
    subject: "A year of showing up 💖",
    heroSymbol: "💖",
    hero: "THANK YOU AGAIN",
    heroText: "Your support has helped keep GPE moving.",
    label: "Donation anniversary",
    heading: "YOU’VE BEEN WITH US",
    bodyHtml: p("Thank you for giving to Girl Plus Environment.", true) + p("A year later, that support still matters.", false, 28),
    button: { label: "Visit Girl Plus Environment", url: GPE_WEBSITE_URL },
    requiredBlockLabel: "Paste Neon donation anniversary merge fields from the current template here.",
    tokens: ["[[NEON_DONATION_ANNIVERSARY_BLOCK]]"],
    text: "Thank you for giving to Girl Plus Environment.\n\nA year later, that support still matters."
  }),
  template("donations", "tribute-acknowledgement", {
    subject: "A gift was made in your honor",
    heroSymbol: "💌",
    hero: "TRIBUTE GIFT",
    heroText: "Someone made a gift to GPE in your honor.",
    label: "Tribute",
    heading: "A BEAUTIFUL NOTE",
    bodyHtml: p("A tribute gift was made to Girl Plus Environment.", true) + p("The details from Neon are below.", false, 28),
    requiredBlockLabel: "Paste Neon tribute recipient, honoree, donor display, gift note, and organization fields here. Do not include private tax receipt fields unless Neon already does.",
    tokens: ["[[NEON_TRIBUTE_DETAILS_BLOCK]]"],
    text: "A tribute gift was made to Girl Plus Environment.\n\n[[NEON_TRIBUTE_DETAILS_BLOCK]]"
  }),
  template("donations", "soft-credit-acknowledgement", {
    subject: "A gift was connected to you",
    heroSymbol: "💌",
    hero: "GIFT CREDIT",
    heroText: "A donation was connected to your GPE record.",
    label: "Soft credit",
    heading: "HERE’S THE NOTE",
    bodyHtml: p("A donation was connected to your GPE record.", true) + p("Review the Neon details below.", false, 28),
    requiredBlockLabel: "Paste Neon soft-credit acknowledgement fields from the current template here.",
    tokens: ["[[NEON_SOFT_CREDIT_DETAILS_BLOCK]]"],
    text: "A donation was connected to your GPE record.\n\n[[NEON_SOFT_CREDIT_DETAILS_BLOCK]]"
  }),
  template("donations", "matched-donation-acknowledgement", {
    subject: "Your gift got matched 💖",
    heroSymbol: "💖",
    hero: "MATCH RECEIVED",
    heroText: "The math is mathing this time.",
    label: "Matched gift",
    heading: "DOUBLE CHECK",
    bodyHtml: p("Your donation match was recorded.", true) + p("Review the matching-gift details from Neon below.", false, 28),
    requiredBlockLabel: "Paste Neon matched donation company, amount, original gift, and receipt fields here.",
    tokens: ["[[NEON_MATCHED_DONATION_DETAILS_BLOCK]]"],
    text: "Your donation match was recorded.\n\n[[NEON_MATCHED_DONATION_DETAILS_BLOCK]]"
  }),
  template("donations", "recurring-created", {
    subject: "Your recurring gift is set 💖",
    heroSymbol: "💖",
    hero: "SCHEDULE SET",
    heroText: "Your recurring gift is ready.",
    label: "Recurring gift",
    heading: "THANK YOU FOR SHOWING UP",
    bodyHtml: p("Your recurring gift to GPE has been created.", true) + p("Review the schedule details below.", false, 28),
    requiredBlockLabel: "Paste Neon recurring schedule, amount, frequency, payment method, and account-management fields here.",
    tokens: ["[[NEON_RECURRING_SCHEDULE_BLOCK]]"],
    text: "Your recurring gift to GPE has been created.\n\n[[NEON_RECURRING_SCHEDULE_BLOCK]]"
  }),
  template("donations", "recurring-updated", {
    subject: "Your recurring gift was updated",
    heroSymbol: "💌",
    hero: "SCHEDULE UPDATED",
    heroText: "We saved your recurring gift update.",
    label: "Recurring gift",
    heading: "UPDATE SAVED",
    bodyHtml: p("Your recurring gift to GPE has been updated.", true) + p("Review the new schedule details below.", false, 28),
    requiredBlockLabel: "Paste Neon recurring schedule update, amount, frequency, payment method, and account-management fields here.",
    tokens: ["[[NEON_RECURRING_SCHEDULE_BLOCK]]"],
    text: "Your recurring gift to GPE has been updated.\n\n[[NEON_RECURRING_SCHEDULE_BLOCK]]"
  }),
  template("donations", "recurring-paused", {
    subject: "Your recurring gift is paused",
    heroSymbol: "💌",
    hero: "SCHEDULE PAUSED",
    heroText: "Your recurring gift is paused.",
    label: "Recurring gift",
    heading: "WE SAVED THE UPDATE",
    bodyHtml: p("Your recurring gift has been paused.", true) + p("Review the schedule details below.", false, 28),
    requiredBlockLabel: "Paste Neon recurring pause date, schedule, and account-management fields here.",
    tokens: ["[[NEON_RECURRING_SCHEDULE_BLOCK]]"],
    text: "Your recurring gift has been paused.\n\n[[NEON_RECURRING_SCHEDULE_BLOCK]]"
  }),
  template("donations", "recurring-cancelled", {
    subject: "Your recurring gift was cancelled",
    heroSymbol: "💌",
    hero: "SCHEDULE CANCELLED",
    heroText: "Your recurring gift has ended.",
    label: "Recurring gift",
    heading: "THANK YOU FOR WHAT YOU GAVE",
    bodyHtml: p("Your recurring gift has been cancelled.", true) + p("Thank you for the support you already shared with GPE.", false, 28),
    requiredBlockLabel: "Paste Neon recurring cancellation details from the current template here.",
    tokens: ["[[NEON_RECURRING_SCHEDULE_BLOCK]]"],
    text: "Your recurring gift has been cancelled.\n\nThank you for the support you already shared with GPE."
  }),
  template("donations", "recurring-notice", {
    subject: "Your recurring gift is coming up",
    heroSymbol: "💖",
    hero: "GIFT NOTICE",
    heroText: "Your scheduled gift is coming up.",
    label: "Recurring gift",
    heading: "HERE’S THE PLAN",
    bodyHtml: p("Your recurring gift is scheduled soon.", true) + p("Review the Neon details below.", false, 28),
    requiredBlockLabel: "Paste Neon upcoming recurring payment date, amount, payment method, and update-link fields here.",
    tokens: ["[[NEON_RECURRING_SCHEDULE_BLOCK]]"],
    text: "Your recurring gift is scheduled soon.\n\n[[NEON_RECURRING_SCHEDULE_BLOCK]]"
  }),
  template("donations", "recurring-error", {
    subject: "Your recurring gift needs attention",
    heroSymbol: "👀",
    hero: "PAYMENT CHECK",
    heroText: "Your scheduled gift could not be processed.",
    label: "Payment issue",
    heading: "LET’S FIX IT",
    bodyHtml: p("Your recurring gift payment did not go through.", true) + p("Update the payment details below if you want the gift to continue.", false, 28),
    button: { label: "Update Payment", url: "[[NEON_PAYMENT_UPDATE_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon recurring payment error and retry fields here.",
    tokens: ["[[NEON_PAYMENT_UPDATE_URL_TOKEN]]", "[[NEON_RECURRING_SCHEDULE_BLOCK]]"],
    text: "Your recurring gift payment did not go through.\n\nUpdate payment:\n[[NEON_PAYMENT_UPDATE_URL_TOKEN]]"
  }),
  template("donations", "pledge-invoice", {
    subject: "Your GPE pledge invoice",
    heroSymbol: "💌",
    hero: "PLEDGE INVOICE",
    heroText: "Your pledge payment details are below.",
    label: "Pledge",
    heading: "KEEP THIS HANDY",
    bodyHtml: p("Your pledge invoice is ready.", true) + p("Review the details and payment link below.", false, 28),
    button: { label: "Pay My Pledge", url: "[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon pledge amount, due date, balance, tax language, and payment fields here.",
    tokens: ["[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]", "[[NEON_PLEDGE_DETAILS_BLOCK]]"],
    text: "Your pledge invoice is ready.\n\nPay my pledge:\n[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]\n\n[[NEON_PLEDGE_DETAILS_BLOCK]]"
  }),
  template("donations", "pledge-overdue", {
    subject: "Your GPE pledge needs attention",
    heroSymbol: "👀",
    hero: "PLEDGE CHECK",
    heroText: "Your pledge due date has passed.",
    label: "Pledge overdue",
    heading: "PAYMENT NEEDED",
    bodyHtml: p("Your pledge payment is overdue.", true) + p("Use the Neon payment link below to complete it.", false, 28),
    button: { label: "Pay My Pledge", url: "[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]" },
    requiredBlockLabel: "Paste Neon overdue pledge balance, due date, and payment fields here.",
    tokens: ["[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]", "[[NEON_PLEDGE_DETAILS_BLOCK]]"],
    text: "Your pledge payment is overdue.\n\nPay my pledge:\n[[NEON_PLEDGE_PAYMENT_URL_TOKEN]]"
  }),
  template("purchases", "purchase-complete", {
    subject: "Your GPE purchase is complete",
    heroSymbol: "💖",
    hero: "PURCHASE COMPLETE",
    heroText: "Thanks for your purchase.",
    label: "Purchase",
    heading: "RECEIPT BELOW",
    bodyHtml: p("Your GPE purchase is complete.", true) + p("Review the purchase details below.", false, 28),
    requiredBlockLabel: "Paste Neon purchase receipt, item, payment, tax, and organization details here.",
    tokens: ["[[NEON_PURCHASE_RECEIPT_BLOCK]]"],
    text: "Your GPE purchase is complete.\n\n[[NEON_PURCHASE_RECEIPT_BLOCK]]"
  }),
  template("purchases", "refund", {
    subject: "Your GPE refund was processed",
    heroSymbol: "💌",
    hero: "REFUND PROCESSED",
    heroText: "Your refund details are below.",
    label: "Refund",
    heading: "KEEP THIS FOR YOUR RECORDS",
    bodyHtml: p("Your refund has been processed.", true) + p("Review the refund details below.", false, 28),
    requiredBlockLabel: "Paste Neon refund amount, original purchase, payment method, and transaction fields here.",
    tokens: ["[[NEON_REFUND_DETAILS_BLOCK]]"],
    text: "Your refund has been processed.\n\n[[NEON_REFUND_DETAILS_BLOCK]]"
  }),
  template("purchases", "exchange", {
    subject: "Your GPE exchange was processed",
    heroSymbol: "💌",
    hero: "EXCHANGE PROCESSED",
    heroText: "Your exchange details are below.",
    label: "Exchange",
    heading: "HERE’S THE UPDATE",
    bodyHtml: p("Your exchange has been processed.", true) + p("Review the updated purchase details below.", false, 28),
    requiredBlockLabel: "Paste Neon exchange, old item, new item, balance, and transaction fields here.",
    tokens: ["[[NEON_EXCHANGE_DETAILS_BLOCK]]"],
    text: "Your exchange has been processed.\n\n[[NEON_EXCHANGE_DETAILS_BLOCK]]"
  }),
  template("volunteers", "volunteer-submitted", {
    subject: "We got your volunteer form 💖",
    heroSymbol: "💖",
    hero: "FORM RECEIVED",
    heroText: "Thanks for raising your hand.",
    label: "Volunteer form",
    heading: "WE’LL BE IN TOUCH",
    bodyHtml: p("We received your volunteer form.", true) + p("Our team will review it and follow up if there’s a good fit.", false, 28),
    button: { label: "Visit GPE", url: GPE_WEBSITE_URL },
    requiredBlockLabel: "Paste Neon volunteer form submission fields from the current confirmation template here.",
    tokens: ["[[NEON_VOLUNTEER_FORM_DETAILS_BLOCK]]"],
    text: "We received your volunteer form.\n\nOur team will review it and follow up if there’s a good fit.\n\nVisit GPE:\nhttps://www.girlplusenvironment.org"
  })
];
