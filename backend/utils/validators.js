import Joi from "joi";

export const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: false,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid request payload.",
      details: error.details.map((d) => d.message),
    });
  }

  req.body = value;
  return next();
};

const optionalString = Joi.string().allow("", null);
const optionalTrimmedString = Joi.string().trim().allow("", null);
const optionalNumber = Joi.number().allow(null);
const optionalDate = Joi.date().allow(null);

export const schemas = {
  authRegister: Joi.object({
    username: Joi.string().trim().min(2).required(),
    email: Joi.string().trim().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).+$/)
      .required()
      .messages({
        "string.pattern.base":
          "Password must include an uppercase letter, a number, and a special character.",
      }),
    position: optionalTrimmedString,
    designation: optionalTrimmedString,
    project: optionalTrimmedString,
    role: optionalTrimmedString,
  }),
  authLogin: Joi.object({
    email: Joi.string().trim().email().required(),
    password: Joi.string().required(),
    stayLoggedIn: Joi.boolean().optional(),
  }),
  authGoogle: Joi.object({
    credential: Joi.string().trim().required(),
    stayLoggedIn: Joi.boolean().optional(),
  }),
  userUpdate: Joi.object({
    username: optionalString,
    email: optionalString,
    position: optionalString,
    designation: optionalString,
    project: optionalString,
    role: optionalString,
    active: Joi.boolean(),
    password: optionalString,
    currentPassword: optionalString,
    adminReset: Joi.boolean(),
    __v: optionalNumber,
  }).min(1),
  distributionCreate: Joi.object({
    request_type: Joi.string().valid("distribution", "disposal").default("distribution"),
    items: Joi.array()
      .items(
        Joi.object({
          stock_no: Joi.number().required(),
          returnId: Joi.string().required(),
          classification: optionalString,
          project: optionalString,
          itemName: optionalString,
          unitofmeasure: optionalString,
          quantity: Joi.number().min(1).required(),
          cost: Joi.number().min(0).required(),
        })
      )
      .min(1)
      .required(),
    distributedto: Joi.when("request_type", {
      is: "disposal",
      then: optionalString,
      otherwise: Joi.string().required(),
    }),
    office: Joi.when("request_type", {
      is: "disposal",
      then: optionalString,
      otherwise: Joi.string().required(),
    }),
    distributedto_is: Joi.when("request_type", {
      is: "disposal",
      then: optionalString,
      otherwise: Joi.string().required(),
    }),
    status: optionalString,
    requeststatus: optionalString,
    date_requested: optionalDate,
    purpose: Joi.when("request_type", {
      is: "disposal",
      then: optionalTrimmedString,
      otherwise: Joi.string().trim().min(1).max(1000).required(),
    }),
    remarks: optionalString,
    disposal_reason: optionalString,
    disposal_notes: optionalString,
  }),
  distributionUpdate: Joi.object({
    request_type: Joi.string().valid("distribution", "disposal"),
    items: Joi.array().items(
      Joi.object({
        stock_no: Joi.number(),
        returnId: Joi.string(),
        classification: optionalString,
        project: optionalString,
        itemName: optionalString,
        unitofmeasure: optionalString,
        quantity: Joi.number().min(1),
        cost: Joi.number().min(0),
      })
    ),
    distributedto: optionalString,
    office: optionalString,
    distributedto_is: optionalString,
    status: optionalString,
    requeststatus: optionalString,
    date_checked: optionalDate,
    date_requested: optionalDate,
    date_approved: optionalDate,
    date_released: optionalDate,
    date_received: optionalDate,
    purpose: Joi.string().trim().min(1).max(1000).allow(null),
    remarks: optionalString,
    disposal_reason: optionalString,
    disposal_notes: optionalString,
    __v: optionalNumber,
  }).min(1),
  emailSend: Joi.object({
    to: Joi.string().trim().email().required(),
    cc: Joi.alternatives()
      .try(Joi.string().trim().email(), Joi.array().items(Joi.string().trim().email()))
      .optional(),
    subject: Joi.string().trim().required(),
    html: Joi.string().trim().required(),
  }),
  settingsUpdate: Joi.object({
    enable_signed_download: Joi.boolean(),
    enable_signed_upload: Joi.boolean(),
    enable_email: Joi.boolean(),
    hide_supply_quantities: Joi.boolean(),
    hide_supply_quantity_roles: Joi.array().items(Joi.string().trim()),
    distribution_request_limit_default: Joi.number().min(1),
    distribution_request_limit_by_role: Joi.object(),
    se_threshold: Joi.number().min(1),
    cleanup_pending_enabled: Joi.boolean(),
    cleanup_pending_days: Joi.number().min(1),
    session_timeout_enabled: Joi.boolean(),
    session_timeout_minutes: Joi.number().min(1),
    role_access: Joi.object(),
    document_signatories: Joi.object({
      ris: Joi.object({
        checker_id: optionalString,
        approver_id: optionalString,
      }),
      ptr: Joi.object({
        approver_id: optionalString,
        releaser_id: optionalString,
      }),
      ics_issuance: Joi.object({ approver_id: optionalString }),
      ics_transfer: Joi.object({ approver_id: optionalString }),
    }),
    __v: optionalNumber,
  }).min(1),
  logCreate: Joi.object({
    userId: optionalString,
    action: Joi.string().required(),
    status: Joi.string().required(),
    time: optionalString,
  }).min(1),
  inventoryPayload: Joi.object({
    itemName: optionalString,
    classification: optionalString,
    unitofmeasure: optionalString,
    status: optionalString,
    qty: optionalNumber,
    stock_qty: optionalNumber,
    balance_qty: optionalNumber,
    distribution_qty: optionalNumber,
    disposed_qty: optionalNumber,
    unit_cost: optionalNumber,
    total_cost: optionalNumber,
    stock_unit_cost: optionalNumber,
    stock_total_cost: optionalNumber,
    balance_unit_cost: optionalNumber,
    balance_total_cost: optionalNumber,
    purchase_qty: optionalNumber,
    purchase_unit_cost: optionalNumber,
    purchase_total_cost: optionalNumber,
    distribution_unit_cost: optionalNumber,
    distribution_total_cost: optionalNumber,
    date: optionalDate,
    date_acquired: optionalDate,
    date_requested: optionalDate,
    date_approved: optionalDate,
    date_released: optionalDate,
    date_received: optionalDate,
    issued_to: optionalString,
    issued_to_id: optionalString,
    current_holder: optionalString,
    current_holder_id: optionalString,
    transfered_to: optionalString,
    transfered_to_id: optionalString,
    transferred_to_id: optionalString,
    transferred_to: optionalString,
    transfer_type: optionalString,
    transfer_target: optionalString,
    stored_to: optionalString,
    remarks: optionalString,
    reason: optionalString,
    inclusions: optionalString,
    specifications: optionalString,
    project: optionalString,
    archive: Joi.boolean().allow(null),
    lowstock_threshold: optionalNumber,
    history: Joi.array(),
    __v: optionalNumber,
  }).min(1),
  measureCreate: Joi.object({
    description: Joi.string().trim().required(),
    active: Joi.boolean().required(),
    designation: Joi.string().trim().required(),
  }),
  measureUpdate: Joi.object({
    description: optionalString,
    active: Joi.boolean(),
    designation: optionalString,
    __v: optionalNumber,
  }).min(1),
  classificationCreate: Joi.object({
    description: Joi.string().trim().required(),
    active: Joi.boolean().required(),
    designation: Joi.string().trim().required(),
  }),
  classificationUpdate: Joi.object({
    description: optionalString,
    active: Joi.boolean(),
    designation: optionalString,
    __v: optionalNumber,
  }).min(1),
};
