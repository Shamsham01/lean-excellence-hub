import type { MaturityFrameworkTemplate } from "./types";
import { LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY } from "./types";

export const LEH_OPERATIONAL_EXCELLENCE_STANDARD: MaturityFrameworkTemplate = {
  key: LEH_OPERATIONAL_EXCELLENCE_STANDARD_KEY,
  name: "LEH Operational Excellence Standard",
  description:
    "A practical Operational Excellence maturity framework covering Operations, Health & Safety, Quality & Technical, Engineering & Asset Reliability, and People & Leadership. Use it as a starting point and tailor it to your organisation.",
  assessmentScopes: ["site"],
  levels: [
    {
      name: "Initial",
      colorToken: "maturity-1",
      description:
        "Work is reactive or inconsistent. Processes depend heavily on individuals, with limited standardisation or measurement.",
      guidance:
        "Look for firefighting, undocumented habits, uneven practices between teams, and little reliable performance data.",
    },
    {
      name: "Developing",
      colorToken: "maturity-2",
      description:
        "Basic processes and expectations exist. Application varies between teams and areas, and improvement is mostly local and reactive.",
      guidance:
        "Look for emerging standards, local routines that are not yet consistent, and improvement activity that starts after problems appear.",
    },
    {
      name: "Defined",
      colorToken: "maturity-3",
      description:
        "Standard processes are documented and understood. Performance is measured, and roles and routines are established.",
      guidance:
        "Look for current documented standards, visible measures, named owners, and routines that people can explain and follow.",
    },
    {
      name: "Embedded",
      colorToken: "maturity-4",
      description:
        "Standards are applied consistently. Leaders routinely review performance, and teams solve problems and improve processes systematically.",
      guidance:
        "Look for consistent application across areas, regular leadership review, and evidence that problems are contained, analysed and closed.",
    },
    {
      name: "Excellence",
      colorToken: "maturity-5",
      description:
        "Continuous improvement is part of normal work. Decisions are evidence-led and proactive, and learning is shared and sustained across the organisation.",
      guidance:
        "Look for proactive, evidence-based decisions, shared learning between teams, and improvement that continues without depending on a few individuals.",
    },
  ],
  pillars: [
    {
      name: "Operations",
      description:
        "How operational work is planned, standardised, flowed and improved day to day.",
      guidance:
        "Assess whether daily routines, standards, planning, flow and improvement are visible in the workplace rather than only in documents.",
      criteria: [
        {
          name: "Daily Management",
          description:
            "How operational performance is reviewed and acted on through routine team management.",
          guidance:
            "Look for established meeting or review routines, visual performance measures, clear escalation, ownership of abnormalities and evidence of follow-through.",
          questions: [
            {
              prompt:
                "Are teams using a consistent routine to review safety, quality, delivery, cost and people performance?",
            },
            {
              prompt:
                "Are abnormalities identified, owned and followed through during daily management?",
            },
          ],
        },
        {
          name: "Standard Work",
          description:
            "How critical activities are defined, kept current and used as the normal way of working.",
          guidance:
            "Look for clear current standards for critical work, evidence that teams understand them, and a routine for checking whether they are followed and updated.",
          questions: [
            {
              prompt:
                "Are critical activities supported by clear and current standards?",
            },
            {
              prompt:
                "Are teams routinely checking whether standard work is understood and followed?",
            },
          ],
        },
        {
          name: "Planning & Schedule Adherence",
          description:
            "How work is planned, sequenced and completed against the intended schedule.",
          guidance:
            "Look for a reliable plan, a way to see schedule status, and a response when work runs late or priorities change.",
          questions: [
            {
              prompt:
                "Is operational work planned with a clear sequence, owner and expected completion time?",
            },
            {
              prompt:
                "Is schedule adherence reviewed, and are missed or late items actively recovered?",
            },
          ],
        },
        {
          name: "Flow & Capacity",
          description:
            "How work, materials and information move through the operation without unnecessary delay or overload.",
          guidance:
            "Look for understood bottlenecks, visible work in progress, and evidence that capacity and constraints are managed rather than left to chance.",
          questions: [
            {
              prompt:
                "Are constraints and bottlenecks understood and managed as part of normal operations?",
            },
            {
              prompt:
                "Is work in progress visible and controlled so that flow is not left to local improvisation?",
            },
          ],
        },
        {
          name: "Waste & Productivity",
          description:
            "How the organisation finds and reduces wasted time, motion, materials and rework.",
          guidance:
            "Look for a shared understanding of waste, visible productivity measures, and improvement that removes causes rather than adding extra effort.",
          questions: [
            {
              prompt:
                "Are sources of waste identified using a consistent method that teams can apply?",
            },
            {
              prompt:
                "Are productivity losses investigated and reduced through changes to the way work is done?",
            },
          ],
        },
        {
          name: "Continuous Improvement",
          description:
            "How operational problems and improvement ideas are captured, progressed and sustained.",
          guidance:
            "Look for a simple way to raise issues, a visible pipeline of improvements, and evidence that completed changes stay in place.",
          questions: [
            {
              prompt:
                "Do teams have a routine way to raise, prioritise and progress operational improvements?",
            },
            {
              prompt:
                "Are completed improvements checked later to confirm they remain in use?",
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
        "Assess leadership behaviour, risk controls, learning from events, safe work practices, emergency readiness and workforce engagement.",
      criteria: [
        {
          name: "Safety Leadership & Accountability",
          description:
            "How leaders set expectations, spend time on safety and hold themselves and others accountable.",
          guidance:
            "Look for leaders who visit the workplace, act on safety concerns, and make accountability visible without relying only on slogans or campaigns.",
          questions: [
            {
              prompt:
                "Do leaders regularly spend time in the workplace reviewing safety conditions and behaviours?",
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
            "Look for easy reporting, timely investigation, verified causes, and actions that change the system rather than only retraining the individual.",
          questions: [
            {
              prompt:
                "Are incidents and near misses reported promptly without fear of unfair blame?",
            },
            {
              prompt:
                "Are investigations used to find and fix causes, with actions checked for effectiveness?",
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
            "Look for current plans, trained roles, practised drills, and after-action learning that improves the next response.",
          questions: [
            {
              prompt:
                "Are emergency plans current, understood and practised for credible site scenarios?",
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
            "Look for workforce involvement, closed-loop responses to concerns, and improvement that is not limited to a safety committee.",
          questions: [
            {
              prompt:
                "Do people have a practical way to raise hazards and safety improvements?",
            },
            {
              prompt:
                "Are raised concerns acknowledged, acted on and fed back to the people who raised them?",
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
        "Assess standards, process control, non-conformance handling, audit, customer quality and the integrity of quality data.",
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
            "Look for defined critical parameters, in-process checks, reaction plans for out-of-control conditions, and records that match the actual process.",
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
            "Look for consistent capture, prompt containment, cause-based corrective action, and checks that the fix worked.",
          questions: [
            {
              prompt:
                "Are non-conformances captured consistently and acted on promptly?",
            },
            {
              prompt:
                "Are corrective actions based on verified causes and checked for effectiveness?",
            },
          ],
        },
        {
          name: "Audit & Compliance",
          description:
            "How the organisation checks that quality requirements are followed and gaps are closed.",
          guidance:
            "Look for a planned audit or verification rhythm, independent enough to be useful, with findings that lead to completed actions.",
          questions: [
            {
              prompt:
                "Is compliance against quality requirements verified through a planned audit or check routine?",
            },
            {
              prompt:
                "Are audit findings tracked to closure with evidence that the gap has been fixed?",
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
        "Assess preventive maintenance, breakdown response, root cause work, planning, critical spares and operator care.",
      criteria: [
        {
          name: "Preventive Maintenance",
          description:
            "How planned maintenance is defined from risk and equipment need, then completed on time.",
          guidance:
            "Look for a maintained plan for critical assets, completion against the plan, and active management of overdue work.",
          questions: [
            {
              prompt:
                "Is preventive maintenance defined for critical assets based on risk and equipment needs?",
            },
            {
              prompt:
                "Is planned maintenance completed reliably and overdue work actively managed?",
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
            "Look for a method to select which failures get deeper analysis, verified causes, and actions that change design, maintenance or operation.",
          questions: [
            {
              prompt:
                "Are significant or repeating failures analysed to find and remove causes?",
            },
            {
              prompt:
                "Do reliability actions change the asset, the maintenance plan or the way the asset is operated?",
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
            "Look for simple inspection and care routines at the asset, clear abnormality flags, and a path to get defects fixed.",
          questions: [
            {
              prompt:
                "Do operators have a defined routine for inspecting and caring for the assets they use?",
            },
            {
              prompt:
                "Are abnormalities found during operator care recorded and resolved before they become failures?",
            },
          ],
        },
      ],
    },
    {
      name: "People & Leadership",
      description:
        "How strategy, roles, skills, communication and culture enable operational excellence.",
      guidance:
        "Assess whether leadership intent reaches the workplace through clear roles, capable people, two-way communication and a fair improvement culture.",
      criteria: [
        {
          name: "Strategy & Leadership",
          description:
            "How operational direction is set, translated into local priorities and reviewed.",
          guidance:
            "Look for a small set of understood priorities, leadership presence in review routines, and alignment between site activity and stated direction.",
          questions: [
            {
              prompt:
                "Can teams explain the current operational priorities and how their work contributes to them?",
            },
            {
              prompt:
                "Do leaders review progress against those priorities and adjust when results are off track?",
            },
          ],
        },
        {
          name: "Roles & Accountability",
          description:
            "How responsibilities are defined, understood and used when work does not happen as expected.",
          guidance:
            "Look for current role expectations, named owners for key processes, and accountability that is fair, visible and not limited to a job title on paper.",
          questions: [
            {
              prompt:
                "Are roles and decision rights clear for the processes that keep the operation running?",
            },
            {
              prompt:
                "When ownership is unclear or missed, is it corrected in a way that people can see and rely on?",
            },
          ],
        },
        {
          name: "Skills & Training",
          description:
            "How required skills are defined, assessed and developed for the work people do.",
          guidance:
            "Look for role-based skill needs, a visible view of gaps, planned development, and confirmation that people are competent before working unsupervised.",
          questions: [
            {
              prompt:
                "Are required skills defined for roles and responsibilities?",
            },
            {
              prompt:
                "Are skill gaps visible and addressed through planned development?",
            },
          ],
        },
        {
          name: "Communication & Engagement",
          description:
            "How information, concerns and decisions move between leaders and teams.",
          guidance:
            "Look for two-way communication, timely cascade of changes, and evidence that people can raise issues and hear what happened next.",
          questions: [
            {
              prompt:
                "Do people receive the information they need to do the work and understand recent changes?",
            },
            {
              prompt:
                "Can people raise concerns and see that those concerns are heard and responded to?",
            },
          ],
        },
        {
          name: "Problem-Solving Capability",
          description:
            "How people are equipped to contain problems, find causes and implement lasting fixes.",
          guidance:
            "Look for a shared method, coaching at the workplace, and completed problem-solving that goes beyond immediate containment.",
          questions: [
            {
              prompt:
                "Do teams use a shared method to contain problems and find causes rather than only applying a quick fix?",
            },
            {
              prompt:
                "Are people coached in problem-solving so capability is not limited to a few specialists?",
            },
          ],
        },
        {
          name: "Recognition & Improvement Culture",
          description:
            "How contribution, learning and improvement are recognised and made normal.",
          guidance:
            "Look for fair recognition of useful contribution, psychological safety to raise problems, and a culture that treats improvement as part of the job.",
          questions: [
            {
              prompt:
                "Are people recognised for raising problems and making improvements, not only for firefighting?",
            },
            {
              prompt:
                "Is it normal to challenge the current way of working when evidence shows a better method?",
            },
          ],
        },
      ],
    },
  ],
};
