# Neon Field Map

Source: `gpe-mirror/neon-form-survey.html`

Survey metadata found:

- Hosted survey ID: `2`
- Neon form internal ID: `47`
- Request ID in export: `a99c4d50-ad66-4753-a041-60c19d38dd7d`
- Neon share/analytics config form ID: `122337:2:153067:47`
- Organization ID shown in exported analytics config: `122337`

Important mapping note: the exported Neon field labeled `Age *` is wired as `account.address.line1.line1` with an address type selector. This is an actual legacy/misconfigured CRM destination in the hosted Neon form, not an extraction artifact: the exported input uses `name="account.address.line1.line1"`, `autocomplete="address-line1"`, `v-model="formData.account.address.line1.line1"`, and the embedded validation rules require `account.address.line1.line1` while labeling it `Age`. Because address line 1 is not a legitimate age destination, the custom implementation keeps age in the survey payload/Supabase audit/Neon activity only and does not write it to Neon account address fields.

| Frontend key | Question label | Answer type | Neon survey field ID | Neon destination | Required | Allowed values | Notes |
|---|---|---:|---:|---|---|---|---|
| `consent` | By checking this box, you’re giving consent to share your information within our organization and with our organizational partners. Your responses will be de-identified, and used to inform the development of a community climate adaptation plan. | checkbox-single | 37 | `surveyFields[0].value` | yes | `37` = I consent | Consent language copied from Neon export. |
| `firstName` | First Name | text |  | `account.name.firstName` | no | free text | Neon account field. |
| `lastName` | Last Name | text |  | `account.name.lastName` | no | free text | Neon account field. |
| `phoneNumber` | Phone Number | text/tel | 44 | `surveyFields[1].value` | yes | free text | Survey field, not Neon phone account field in export. |
| `emailAddress` | Email Address | email | 45 | `surveyFields[2].value` | yes | valid email | Function also maps normalized email for account matching. |
| `age` | Age | text |  | `surveyPayload.age` | yes | free text | Neon export maps this to `account.address.line1.line1`, but custom integration intentionally does not write age into address line 1. Stored in Supabase `sanitized_answers` and Neon activity payload. |
| `city` | City | text |  | `account.address.city` | no | free text | Address field. |
| `stateOrProvince` | State/Province | select |  | `account.address.stateOrProvince` | no | AL, AK, AZ, AR, CA, CO, CT, DE, DC, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY, AS, FM, GU, MH, MP, PW, PR, UM, VI, AA, AE, AP, AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT | Address field. |
| `zipCode` | Zip | text |  | `account.address.zipCode` | yes | free text | Address field. |
| `raceEthnicity` | Race/Ethnicity | text | 47 | `surveyFields[3].value` | yes | free text |  |
| `gender` | Gender | text | 46 | `surveyFields[4].value` | yes | free text |  |
| `educationLevel` | Highest Education Level Completed | select | 42 | `surveyFields[5].value` | no | `186` HS Diploma/GED; `187` Bachelor's Degree; `188` Master's Degree; `189` PhD/Doctorate; `190` None of the Above; `191` Prefer Not to Say |  |
| `currentIncome` | Current Income | select | 43 | `surveyFields[6].value` | no | `192` Less than $15,000; `193` $15,000 - $49,999; `194` $50,000 - $75,000; `195` More than $75,000 |  |
| `climateEventsConcerned` | Which of the following climate events are you most concerned about? (Please choose no more than 3) | checkbox | 39 | `surveyFields[7].value` | yes | `39` Extreme heat; `171` Flooding events; `172` Major storms and hurricanes; `173` Impacts on mental health and well-being; `174` Loss of financial stability due to a climate event; `175` Access to clean drinking water; `176` Contaminated soil | Max 3 enforced. |
| `climateIssuesAffected` | Which of the following climate-related issues have affected you or your household in the past 5 years? (Select all that apply) | checkbox | 40 | `surveyFields[8].value` | yes | `40` Flooding or heavy rain; `178` Extreme heat; `179` Hurricanes or tropical storms; `180` Power outages; `181` Poor air quality; `182` Mold or water damage in home; `183` Rising utility costs; `184` None of the above; `185` Other (please specify) |  |
| `climateIssuesOther` | Please specify if you selected "Other" | text | 41 | `surveyFields[9].value` | no | free text |  |
| `impactFrequency` | How often do these climate impacts affect your daily life? | select | 21 | `surveyFields[10].value` | yes | `99` Very often; `100` Sometimes; `101` Rarely; `102` Never |  |
| `lifeAreasAffected` | Which areas of your life have been most affected? (Select up to 3) | checkbox | 22 | `surveyFields[11].value` | yes | `22` Housing or home safety; `104` Health or medical needs; `105` Transportation; `106` Employment or income; `107` Childcare or schools; `108` Food access; `109` Elder or disability care | Max 3 enforced. |
| `safetyConfidence` | During extreme weather (heat, storms, flooding), how confident are you that you can stay safe? | select | 23 | `surveyFields[12].value` | yes | `110` Very confident; `111` Somewhat confident; `112` Not very confident; `113` Not confident at all |  |
| `preparednessBarriers` | What makes it harder for you or your community to prepare for or recover from climate events? (Select all that apply) | checkbox | 24 | `surveyFields[13].value` | yes | `24` Cost of repairs or supplies; `115` Limited transportation; `116` Health conditions or disability; `117` Language barriers; `118` Lack of information; `119` Housing conditions (renting, older homes, mobile homes); `120` Feeling unheard by decision-makers; `121` Other (please specify) |  |
| `preparednessBarriersOther` | Please specify if you selected "Other" | text | 25 | `surveyFields[14].value` | no | free text |  |
| `mostImpactedGroups` | Which groups in your community do you believe are most impacted by climate change? (Select all that apply) | checkbox | 26 | `surveyFields[15].value` | yes | `26` Seniors; `123` Children; `124` People with disabilities; `125` Low-income households; `126` Black or historically marginalized communities; `127` Outdoor workers; `128` Renters; `129` People without reliable transportation |  |
| `cityPriorities` | Which actions should the city prioritize FIRST to protect your community? (Select up to 3) | checkbox | 27 | `surveyFields[16].value` | yes | `27` Flood prevention and drainage improvements; `131` Cooling centers or heat relief; `132` Emergency preparedness and evacuation support; `133` Affordable home repairs or weatherization; `134` Reliable public transportation; `135` Tree planting and shade; `136` Clean energy or utility cost relief; `137` Better communication before emergencies | Max 3 enforced. |
| `longTermInvestments` | What long-term investments would help your community be more resilient in the future? (Select up to 3) | checkbox | 28 | `surveyFields[17].value` | yes | `28` Stronger housing standards; `139` Job training in climate-resilient industries; `140` Improved infrastructure (roads, drainage, utilities); `141` Community-based emergency hubs; `142` Environmental education and outreach; `143` Support for small businesses; `144` Protection of coastal and natural areas; `145` Other | Max 3 enforced. |
| `longTermInvestmentsOther` | Please specify if you selected "Other" | text | 29 | `surveyFields[18].value` | no | free text |  |
| `concernsHeard` | Do you feel your community’s concerns are heard when the city plans for emergencies or climate issues? | select | 30 | `surveyFields[19].value` | yes | `146` Yes; `147` Sometimes; `148` No; `149` Unsure |  |
| `communicationPreference` | How would you prefer to receive information about climate risks and city plans? (Select all that apply) | checkbox | 31 | `surveyFields[20].value` | yes | `31` Text messages; `151` Social media; `152` Community meetings; `153` Faith-based or community organizations; `154` Local radio or TV; `155` Flyers or mail; `156` Word of mouth; `157` Other |  |
| `communicationPreferenceOther` | Please specify if you selected "Other" | text | 32 | `surveyFields[21].value` | no | free text |  |
| `oneChange` | What is one change the city could make to better protect your community from climate impacts? | textarea | 33 | `surveyFields[22].value` | no | free text |  |
| `planUpdates` | Would you like to be informed about the process of creating a Mobile Climate Adaptation Plan? | radio | 34 | `surveyFields[23].value` | yes | `34` Yes; `159` No |  |
| `gpeUpdates` | Would you like to stay up to date on GPE happenings, events, and actions? | radio | 36 | `surveyFields[24].value` | yes | `36` Yes; `161` No |  |
