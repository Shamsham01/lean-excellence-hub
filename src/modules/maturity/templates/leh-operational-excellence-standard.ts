import type { MaturityFrameworkTemplate } from "./types";
import { LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY } from "./types";

export const LEH_OPERATIONAL_EXCELLENCE_STANDARD: MaturityFrameworkTemplate = {
  key: LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY,
  name: "LEH Operational Excellence Standard",
  description:
    "A practical Operational Excellence maturity framework covering Operations, Health & Safety, Quality & Technical, Engineering & Asset Reliability, and People & Leadership. It assesses connected operating-system behaviours such as workplace organisation, Gemba, daily management, improvement participation, structured problem solving, capability planning and benefit realisation. Use it as a starting point and tailor it to your organisation.",
  assessmentScopes: ["site"],
  levels: [
    {
      name: "Initial",
      colorToken: "maturity-1",
      description:
        "Work is reactive or inconsistent. Processes depend heavily on individuals, with limited standardisation, scheduling or measurement.",
      guidance:
        "Look for firefighting, undocumented habits, uneven practices between teams, and little reliable performance data. Planned routines such as workplace organisation audits, Gemba, training or reviews are absent or person-dependent.",
    },
    {
      name: "Developing",
      colorToken: "maturity-2",
      description:
        "Basic processes and expectations exist. Application varies between teams and areas, and improvement is mostly local and reactive.",
      guidance:
        "Look for emerging standards and local routines that are not yet consistent. Some planned activity happens, but adherence is patchy and follow-up is unreliable. Numeric examples in criteria are indicative starter evidence, not a complete scorecard.",
    },
    {
      name: "Defined",
      colorToken: "maturity-3",
      description:
        "Standard processes are documented and understood. Performance is measured, and roles and routines are established.",
      guidance:
        "Look for current documented standards, named owners, a formal schedule for recurring routines, and people who can explain the method. Execution is established even if adherence is not yet highly reliable.",
    },
    {
      name: "Embedded",
      colorToken: "maturity-4",
      description:
        "Standards are applied consistently. Leaders routinely review performance, and teams solve problems and improve processes systematically.",
      guidance:
        "Look for strong schedule adherence, data-based review, overdue work that is visible and escalated, and evidence that problems are contained, analysed and closed. Hitting one numeric target is not enough if the surrounding management system is weak.",
    },
    {
      name: "Excellence",
      colorToken: "maturity-5",
      description:
        "Continuous improvement is part of normal work. Decisions are evidence-led and proactive, and learning is shared and sustained across the organisation.",
      guidance:
        "Look for highly reliable execution of planned routines, broad workforce participation, closed-loop learning, validated results and continuous adaptation. Indicative evidence in criteria (for example audit or training adherence around 95%, or strong improvement participation) should sit alongside a functioning management system, not replace it.",
    },
  ],
  pillars: [
    {
      name: "Operations",
      description:
        "How operational work is standardised, reviewed, organised, observed and improved day to day.",
      guidance:
        "Assess whether daily management, standards, workplace organisation, Gemba and structured improvement are visible in the workplace and run as scheduled routines, not only as documents.",
      criteria: [
        {
          name: "Daily Management / LDMS",
          description:
            "How operational performance is reviewed through Daily Management / LDMS routines and converted into disciplined, owned action.",
          guidance:
            "Look for a consistent review of safety, quality, delivery, cost and people; abnormalities made visible; and every actionable issue given an owner and due date. Overdue actions should be reviewed and escalated. Closure should resolve the issue, not only mark it complete. Indicative Excellence: 100% of active actions have owners and due dates; at least 95% complete by the agreed date; overdue backlog is exceptional and visible. These are starter thresholds you can tailor after deploying the draft. The name LDMS is not required.",
          questions: [
            {
              prompt:
                "Are Daily Management / LDMS reviews used consistently to inspect safety, quality, delivery, cost and people performance, with abnormalities made visible?",
            },
            {
              prompt:
                "Do issues raised through daily management become owned actions with due dates, and are overdue items reviewed, escalated and closed in a way that actually resolves the issue?",
            },
          ],
        },
        {
          name: "Standard Work",
          description:
            "How critical activities are defined, kept current and used as the normal way of working.",
          guidance:
            "Look for clear current standards at the point of work, evidence that teams understand them, and a routine for checking whether they are followed and updated. A standard that exists only in a file store is not Excellence.",
          questions: [
            {
              prompt:
                "Are critical activities supported by clear, current standards that teams can access at the point of work?",
            },
            {
              prompt:
                "Are standards checked in use and updated when the method changes, rather than left as one-off documents?",
            },
          ],
        },
        {
          name: "5S / Workplace Organisation",
          description:
            "How workplace organisation / 5S standards are defined, audited to a planned schedule, acted on and sustained.",
          guidance:
            "Do not require the organisation to use the name 5S. Look for a defined standard, a planned audit routine rather than one-off clean-ups, completion against that schedule, findings that create owned corrective actions, and evidence that standards are sustained between audits. Indicative Excellence: at least 95% planned audit adherence; clear ownership of findings; minimal overdue corrective actions. Tailor thresholds after deploying the draft.",
          questions: [
            {
              prompt:
                "Is there a defined workplace organisation / 5S standard, and are planned audits completed at the required frequency rather than as one-off clean-ups?",
            },
            {
              prompt:
                "Are workplace organisation / 5S findings converted into owned corrective actions that are closed effectively, so that standards are sustained?",
            },
          ],
        },
        {
          name: "Gemba Management",
          description:
            "How leaders conduct structured Gemba activity, record observations and close the loop.",
          guidance:
            "Informal walkabouts are not enough. Look for a planned Gemba cadence, completion against schedule, relevant leadership participation, recorded observations, follow-up actions, learning, and escalation of repeated issues. Indicative Excellence: at least 95% planned Gemba adherence; material findings acted on; repeated issues visible and escalated. Tailor thresholds after deploying the draft.",
          questions: [
            {
              prompt:
                "Are planned Gemba walks completed to schedule, with relevant leaders participating and observations recorded?",
            },
            {
              prompt:
                "Are Gemba observations converted into owned actions, learning or escalation where required, and is follow-up closed rather than left informal?",
            },
          ],
        },
        {
          name: "Flow & Capacity",
          description:
            "How work, materials and information move through the operation without unnecessary delay or overload.",
          guidance:
            "Look for understood bottlenecks, visible work in progress, and evidence that capacity and constraints are managed rather than left to chance or local improvisation.",
          questions: [
            {
              prompt:
                "Are constraints and bottlenecks understood and managed as part of normal operations rather than discovered only in a crisis?",
            },
            {
              prompt:
                "Is work in progress visible and controlled so that flow is not left to local improvisation?",
            },
          ],
        },
        {
          name: "Structured Improvement Activity",
          description:
            "Whether the organisation completes enough meaningful structured improvement work relative to its workforce, and whether that work reaches verified closure.",
          guidance:
            "Qualifying activity can include Kaizen events, CI projects, structured problem-solving cases and significant cross-functional improvement. A useful normalised view is completed structured improvement activities per 100 employees per year. LEH starter thresholds, which you can tailor after deploying: Level 1 none or largely ad hoc; Level 2 at least 1; Level 3 at least 3; Level 4 at least 4; Level 5 at least 5. Also assess whether activities address real problems, use an appropriate method, have owners, reach closure and verify results. Volume without quality is not Excellence.",
          questions: [
            {
              prompt:
                "Does the site complete enough structured improvement activity for its workforce size, using a normalised view such as completed Kaizen events, CI projects or structured problem-solving cases per 100 employees per year?",
            },
            {
              prompt:
                "Do those activities address meaningful problems, have accountable owners, use an appropriate method, reach closure and verify that results were achieved?",
            },
          ],
        },
      ],
    },
    {
      name: "Health & Safety",
      description:
        "How the organisation prevents harm, controls operational risk and learns from incidents.",
      guidance:
        "Assess leadership behaviour, risk controls, learning from events, safe work practices, emergency readiness and workforce engagement. Planned routines and closed-loop actions matter more than slogans.",
      criteria: [
        {
          name: "Safety Leadership & Accountability",
          description:
            "How leaders set safety expectations, spend planned time in the workplace and hold themselves and others accountable.",
          guidance:
            "Look for leaders who complete planned workplace presence, act on safety concerns, and make accountability visible without relying only on slogans or campaigns.",
          questions: [
            {
              prompt:
                "Do leaders complete planned time in the workplace reviewing safety conditions and behaviours, rather than relying on campaigns or reports alone?",
            },
            {
              prompt:
                "Are safety responsibilities clear, and are people held to them when expectations are not met?",
            },
          ],
        },
        {
          name: "Risk Assessment & Controls",
          description:
            "How operational risks are identified, assessed and kept under control as work changes.",
          guidance:
            "Look for systematic risk assessment, implemented controls, and review when equipment, methods or conditions change.",
          questions: [
            {
              prompt:
                "Are operational risks systematically identified, assessed and controlled?",
            },
            {
              prompt:
                "Are controls reviewed when work, equipment or conditions change?",
            },
          ],
        },
        {
          name: "Incident & Near-Miss Learning",
          description:
            "How incidents and near misses are reported, investigated and used to prevent recurrence.",
          guidance:
            "Look for easy reporting, timely investigation, containment separated from root cause, tested causes, and actions that change the system rather than only retraining the individual. Effectiveness of actions should be checked.",
          questions: [
            {
              prompt:
                "Are incidents and near misses reported promptly without fear of unfair blame?",
            },
            {
              prompt:
                "Do investigations separate containment from root cause, test causes, and verify that actions prevent recurrence?",
            },
          ],
        },
        {
          name: "Safe Work Practices",
          description:
            "How people are protected by practical methods for high-risk and everyday work.",
          guidance:
            "Look for current safe methods, competence to use them, and confirmation that they are applied at the point of work.",
          questions: [
            {
              prompt:
                "Are safe methods defined for high-risk and routine work that people actually use?",
            },
            {
              prompt:
                "Are people competent in those methods before they carry out the work unsupervised?",
            },
          ],
        },
        {
          name: "Emergency Preparedness",
          description:
            "How the organisation prepares for and responds to emergencies and abnormal events.",
          guidance:
            "Look for current plans, trained roles, drills completed against a planned schedule, and after-action learning that improves the next response. A plan that is never practised is not Excellence.",
          questions: [
            {
              prompt:
                "Are emergency plans current, understood and practised on a planned schedule for credible site scenarios?",
            },
            {
              prompt:
                "Are emergency roles, equipment and communication methods checked so they will work when needed?",
            },
          ],
        },
        {
          name: "Safety Engagement & Improvement",
          description:
            "How people participate in spotting hazards and improving safety as part of normal work.",
          guidance:
            "Look for workforce involvement, timely acknowledgement, owned actions, and feedback to the people who raised concerns. Improvement should not be limited to a safety committee.",
          questions: [
            {
              prompt:
                "Do people have a practical way to raise hazards and safety improvements as part of normal work?",
            },
            {
              prompt:
                "Are raised safety concerns acknowledged, acted on and fed back, so people can see what happened to their input?",
            },
          ],
        },
      ],
    },
    {
      name: "Quality & Technical",
      description:
        "How product and process quality is specified, controlled, traced and improved.",
      guidance:
        "Assess standards, process control, non-conformance handling, planned audit, customer quality and the integrity of quality data.",
      criteria: [
        {
          name: "Quality Standards & Governance",
          description:
            "How quality requirements are defined, owned and kept current for the operation.",
          guidance:
            "Look for clear specifications, named owners, and a way to update standards when requirements or processes change.",
          questions: [
            {
              prompt:
                "Are quality requirements documented, owned and accessible to the people who need them?",
            },
            {
              prompt:
                "Are quality standards reviewed and updated when products, processes or customer needs change?",
            },
          ],
        },
        {
          name: "Process Control",
          description:
            "How critical process parameters are set, monitored and kept in control.",
          guidance:
            "Look for defined critical parameters, in-process checks at a useful frequency, reaction plans for out-of-control conditions, and records that match the actual process.",
          questions: [
            {
              prompt:
                "Are critical process parameters defined, monitored and reacted to when they drift?",
            },
            {
              prompt:
                "Do process checks happen at the frequency needed to prevent defects rather than only to record them?",
            },
          ],
        },
        {
          name: "Non-Conformance & Corrective Action",
          description:
            "How non-conformances are captured, contained, corrected and prevented from returning.",
          guidance:
            "Look for consistent capture, prompt containment, cause-based corrective action using an appropriate structured method, and checks that the fix worked. Containment is not the same as root-cause correction.",
          questions: [
            {
              prompt:
                "Are non-conformances captured consistently, contained promptly, and owned through to closure?",
            },
            {
              prompt:
                "Are corrective actions based on verified causes, checked for effectiveness, and used to prevent recurrence rather than only treating the symptom?",
            },
          ],
        },
        {
          name: "Audit & Compliance",
          description:
            "How the organisation checks that quality requirements are followed and that gaps are closed.",
          guidance:
            "Look for a planned audit or assessment rhythm whose completion is measured, independent enough to be useful, with findings that become owned actions and are closed with evidence. A documented audit plan with poor adherence is not Excellence.",
          questions: [
            {
              prompt:
                "Is compliance against quality requirements verified through a planned audit or assessment routine, and is completion against that schedule measured?",
            },
            {
              prompt:
                "Are audit findings tracked to owned actions and closed with evidence that the gap has been fixed?",
            },
          ],
        },
        {
          name: "Customer / Stakeholder Quality",
          description:
            "How customer and stakeholder quality needs are understood, protected and used to improve.",
          guidance:
            "Look for known customer requirements, rapid response to complaints or escapes, and feedback that changes the process.",
          questions: [
            {
              prompt:
                "Are customer and stakeholder quality requirements understood at the point of work?",
            },
            {
              prompt:
                "Are complaints, returns or quality escapes investigated and used to prevent recurrence?",
            },
          ],
        },
        {
          name: "Quality Data & Traceability",
          description:
            "How quality records remain accurate, retrievable and able to support investigation.",
          guidance:
            "Look for records that can reconstruct what was made, when, by whom and against which standard, without depending on informal knowledge.",
          questions: [
            {
              prompt:
                "Can the organisation trace product or process history when a quality issue is found?",
            },
            {
              prompt:
                "Are quality records complete, timely and reliable enough to support decisions and investigations?",
            },
          ],
        },
      ],
    },
    {
      name: "Engineering & Asset Reliability",
      description:
        "How assets are maintained, restored and improved so they run safely and reliably.",
      guidance:
        "Assess preventive maintenance, breakdown response, root cause work, planning, critical spares and operator care. Planned maintenance and defect closure should be scheduled and measured, not only intended.",
      criteria: [
        {
          name: "Preventive Maintenance",
          description:
            "How planned maintenance is defined from risk and equipment need, scheduled and completed on time.",
          guidance:
            "Look for a maintained plan for critical assets, a formal schedule, completion against that plan, and active management of overdue work. Indicative Excellence: highly reliable completion of planned work, with overdue maintenance exceptional and owned.",
          questions: [
            {
              prompt:
                "Is preventive maintenance defined for critical assets based on risk and equipment needs, and is that plan formally scheduled?",
            },
            {
              prompt:
                "Is planned maintenance completed to schedule, and is overdue work visible, owned and recovered?",
            },
          ],
        },
        {
          name: "Breakdown Response",
          description:
            "How failures are contained, restored and handed back without losing learning.",
          guidance:
            "Look for a clear response path, communication to operations, restoration standards, and capture of failure information for later analysis.",
          questions: [
            {
              prompt:
                "Is there a defined response when an asset fails, including who acts and how operations are protected?",
            },
            {
              prompt:
                "Is breakdown information captured so that repeated failures can be analysed later?",
            },
          ],
        },
        {
          name: "Reliability & Root Cause Analysis",
          description:
            "How chronic and significant failures are analysed and permanently reduced.",
          guidance:
            "Look for a method to select which failures get deeper analysis, an appropriate structured problem-solving approach, verified causes, and actions that change design, maintenance or operation. Effectiveness should be checked.",
          questions: [
            {
              prompt:
                "Are significant or repeating failures analysed with a structured method that separates containment from verified causes?",
            },
            {
              prompt:
                "Do reliability actions change the asset, the maintenance plan or the way the asset is operated, and is effectiveness checked?",
            },
          ],
        },
        {
          name: "Maintenance Planning",
          description:
            "How maintenance work is prepared, scheduled and coordinated with operations.",
          guidance:
            "Look for prepared jobs, available parts and access, a shared schedule, and a review of plan quality rather than only firefighting.",
          questions: [
            {
              prompt:
                "Is maintenance work planned with the parts, information and access needed before it starts?",
            },
            {
              prompt:
                "Is the maintenance schedule coordinated with operations so work can be completed as planned?",
            },
          ],
        },
        {
          name: "Critical Assets & Spares",
          description:
            "How the organisation identifies critical equipment and keeps the right spares available.",
          guidance:
            "Look for a current criticality view, spare strategies that match risk, and evidence that missing parts are not a recurring cause of delay.",
          questions: [
            {
              prompt:
                "Are critical assets identified, and is that view used to set maintenance and spare priorities?",
            },
            {
              prompt:
                "Are spare parts for critical assets available when needed, with shortages visible and managed?",
            },
          ],
        },
        {
          name: "Operator Care / Basic Asset Care",
          description:
            "How operators help keep assets clean, inspected and in basic working condition.",
          guidance:
            "Look for simple inspection and care routines at the asset, often aligned with workplace organisation standards, with abnormalities recorded as owned actions and resolved before they become failures.",
          questions: [
            {
              prompt:
                "Do operators have a defined, scheduled routine for inspecting and caring for the assets they use?",
            },
            {
              prompt:
                "Are abnormalities found during operator care recorded as owned actions and resolved before they become failures?",
            },
          ],
        },
      ],
    },
    {
      name: "People & Leadership",
      description:
        "How strategy, capability, workforce improvement, project governance and problem-solving discipline enable operational excellence.",
      guidance:
        "Assess whether leadership intent reaches the workplace through clear priorities, a maintained Lean / CI capability plan, delivered training, broad improvement participation, governed projects with validated benefits, and structured problem solving.",
      criteria: [
        {
          name: "Strategy & Leadership",
          description:
            "How operational direction is set, translated into local priorities and reviewed.",
          guidance:
            "Look for a small set of understood priorities, leadership presence in review routines, and alignment between site activity and stated direction. Review should happen on a planned cadence, not only after a miss.",
          questions: [
            {
              prompt:
                "Can teams explain the current operational priorities and how their work contributes to them?",
            },
            {
              prompt:
                "Do leaders review progress against those priorities on a planned cadence and adjust when results are off track?",
            },
          ],
        },
        {
          name: "Lean / CI Capability Matrix",
          description:
            "How required Lean / CI capability is defined by role, compared with current capability, and planned forward.",
          guidance:
            "Look for a role-based matrix covering required capability, current level, gaps, planned development and future demand. The LEH starter standard encourages a three-year Lean / CI capability and training forecast tied to operational and business needs. A spreadsheet that exists but is not maintained is not Excellence.",
          questions: [
            {
              prompt:
                "Is there a role-based Lean / CI capability matrix that shows required capability, current capability, gaps and planned development?",
            },
            {
              prompt:
                "Is that matrix actively maintained and linked to a forward development plan covering approximately the next three years?",
            },
          ],
        },
        {
          name: "Training Plan Compliance",
          description:
            "Whether planned Lean / CI and other required capability training is actually delivered.",
          guidance:
            "Separate planning from execution. Look for planned learners, planned completion dates, actual completion, overdue training, mandatory capability gaps and, where relevant, competence verification. Indicative Excellence: at least 95% of planned CI / Lean training delivered within the required period; overdue mandatory gaps exceptional; competence verified where the role requires it. Tailor thresholds after deploying the draft.",
          questions: [
            {
              prompt:
                "Is planned Lean / CI training completed to schedule for the people and roles identified in the capability plan?",
            },
            {
              prompt:
                "Are overdue or missed mandatory capability gaps visible, owned and closed, with competence verified where the role requires it?",
            },
          ],
        },
        {
          name: "Workforce Improvement Participation",
          description:
            "How broadly people contribute improvement ideas, and whether the organisation responds without encouraging low-quality volume.",
          guidance:
            "Do not rely only on raw suggestion count. Assess participation rate (share of active employees contributing at least one idea in a defined period) and improvement activity rate (ideas per employee per year). Look for timely review, feedback, implementation of viable ideas, and visibility of what happened. Indicative Excellence: around 90% or more employee participation over the defined period, with a healthy idea rate and no incentive for spam. Tailor thresholds after deploying the draft. Use aggregate workforce measures, not individual ranking.",
          questions: [
            {
              prompt:
                "Is workforce improvement participation broad and measurable, rather than limited to a few enthusiasts or judged only by raw idea count?",
            },
            {
              prompt:
                "Are submitted ideas reviewed consistently, with feedback to contributors and implementation of viable ideas so people can see what happened?",
            },
          ],
        },
        {
          name: "Improvement Projects & Benefits",
          description:
            "How improvement projects are governed, measured and proven rather than merely claimed.",
          guidance:
            "Look for clear problems or objectives, defined owners and teams, planned milestones, measured results, forecast benefits, validated realised value, and sustainment checks. A project list without benefit validation is not Excellence.",
          questions: [
            {
              prompt:
                "Do improvement projects have a clear problem or objective, an accountable owner and team, and planned milestones that are reviewed to closure?",
            },
            {
              prompt:
                "Are expected benefits forecast, realised value validated rather than merely claimed, and sustainment of results checked after implementation?",
            },
          ],
        },
        {
          name: "Problem-Solving Discipline",
          description:
            "How significant problems are investigated with an appropriate structured method and closed with verified, sustained countermeasures.",
          guidance:
            "Do not mandate one methodology. A3, 8D, DMAIC, PDCA or a bespoke structured method are all acceptable if used with discipline. Look for evidence-based problem statements, understood current condition, containment separated from root cause, tested causes, countermeasures that address verified causes, effectiveness checks, sustainment, and reuse of previous learning.",
          questions: [
            {
              prompt:
                "Do significant problems use an appropriate structured method, with an evidence-based problem statement and a clear understanding of the current condition?",
            },
            {
              prompt:
                "Are containment, verified causes, countermeasures, effectiveness checks and sustainment treated as distinct steps, and is previous learning reused?",
            },
          ],
        },
      ],
    },
  ],
};
