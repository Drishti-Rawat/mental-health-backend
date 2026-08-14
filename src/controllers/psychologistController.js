import Psychologist from '../models/Psychologist.js';
import User from '../models/User.js';
import { sendTherapistInviteEmail } from '../services/emailService.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * @desc    Get all psychologists with search, filter & pagination
 * @route   GET /api/psychologists
 * @access  Public / Admin
 */
export const getAllPsychologists = async (req, res, next) => {
  try {
    const { search, status, specialty } = req.query;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (specialty && specialty !== 'all') {
      query.specialties = { $in: [new RegExp(specialty, 'i')] };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { qualifications: { $regex: search, $options: 'i' } },
        { specialties: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const totalRecords = await Psychologist.countDocuments(query);
    const psychologistsDocs = await Psychologist.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // Calculate aggregated summary stats for admin dashboard
    const totalCount = await Psychologist.countDocuments({});
    const activeCount = await Psychologist.countDocuments({ status: 'active' });
    const pendingCount = await Psychologist.countDocuments({ status: 'pending_approval' });
    const inactiveCount = await Psychologist.countDocuments({ status: 'inactive' });

    const avgStats = await Psychologist.aggregate([
      {
        $group: {
          _id: null,
          avgFee: { $avg: '$consultationFee' },
          avgExp: { $avg: '$experienceYears' },
        },
      },
    ]);

    const stats = {
      total: totalCount,
      active: activeCount,
      pending: pendingCount,
      inactive: inactiveCount,
      avgFee: Math.round(avgStats[0]?.avgFee || 0),
      avgExperience: Math.round((avgStats[0]?.avgExp || 0) * 10) / 10,
    };

    res.status(200).json({
      success: true,
      count: psychologistsDocs.length,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats,
      psychologists: psychologistsDocs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single psychologist profile details by ID
 * @route   GET /api/psychologists/:id
 * @access  Public
 */
export const getPsychologistById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const psychologist = await Psychologist.findById(id);
    if (!psychologist) {
      return res.status(404).json({
        success: false,
        message: 'Psychologist profile not found',
      });
    }

    res.status(200).json({
      success: true,
      psychologist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Public Therapist Self-Application Form (Online Registration Request)
 * @route   POST /api/psychologists/apply
 * @access  Public
 */
export const applyPsychologist = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      title,
      specialties,
      qualifications,
      experienceYears,
      consultationFee,
      bio,
      languages,
    } = req.body;

    if (!name || !email || !title) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and title are required for application',
      });
    }

    const existing = await Psychologist.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An application or record with this email address already exists',
      });
    }

    const parsedSpecialties = Array.isArray(specialties)
      ? specialties
      : typeof specialties === 'string'
      ? specialties.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const parsedLanguages = Array.isArray(languages)
      ? languages
      : typeof languages === 'string'
      ? languages.split(',').map((l) => l.trim()).filter(Boolean)
      : [];

    const psychologist = await Psychologist.create({
      name,
      email: email.toLowerCase(),
      phone: phone || '',
      title,
      specialties: parsedSpecialties,
      qualifications: qualifications || '',
      experienceYears: Number(experienceYears) || 0,
      consultationFee: Number(consultationFee) || 0,
      bio: bio || '',
      languages: parsedLanguages,
      status: 'pending_approval',
    });

    res.status(201).json({
      success: true,
      message: 'Therapist application submitted successfully! Pending admin approval.',
      psychologist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve therapist application & send Invitation Magic Link Email
 * @route   PATCH /api/psychologists/:id/approve
 * @access  Private/Admin
 */
export const approvePsychologist = async (req, res, next) => {
  try {
    const { id } = req.params;

    const psychologist = await Psychologist.findById(id);
    if (!psychologist) {
      return res.status(404).json({
        success: false,
        message: 'Psychologist profile not found',
      });
    }

    // Generate 32-byte hex crypto token (expires in 7 days)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    psychologist.inviteToken = rawToken;
    psychologist.inviteTokenExpires = expiresAt;
    psychologist.status = 'approved';
    await psychologist.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const inviteUrl = `${clientUrl}/set-password?token=${rawToken}`;

    // Send automated Therapist Activation Email via Nodemailer
    const emailResult = await sendTherapistInviteEmail({
      toEmail: psychologist.email,
      practitionerName: psychologist.name,
      inviteUrl,
    });

    res.status(200).json({
      success: true,
      message: `Approved ${psychologist.name}! ${emailResult.sent ? 'Invitation email sent successfully.' : 'Magic Link generated.'}`,
      inviteUrl,
      emailResult,
      token: rawToken,
      expiresAt,
      psychologist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject therapist application
 * @route   PATCH /api/psychologists/:id/reject
 * @access  Private/Admin
 */
export const rejectPsychologist = async (req, res, next) => {
  try {
    const { id } = req.params;

    const psychologist = await Psychologist.findById(id);
    if (!psychologist) {
      return res.status(404).json({
        success: false,
        message: 'Psychologist profile not found',
      });
    }

    psychologist.status = 'rejected';
    psychologist.inviteToken = null;
    psychologist.inviteTokenExpires = null;
    await psychologist.save();

    if (psychologist.user) {
      await User.findByIdAndUpdate(psychologist.user, {
        status: 'rejected',
      });
    }

    res.status(200).json({
      success: true,
      message: `Therapist application for ${psychologist.name} rejected.`,
      psychologist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create / Add a new psychologist & send Invitation Magic Link Email
 * @route   POST /api/psychologists
 * @access  Private/Admin
 */
export const createPsychologist = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      title,
      specialties,
      qualifications,
      experienceYears,
      consultationFee,
      currency,
      bio,
      image,
      languages,
      status,
    } = req.body;

    if (!name || !email || !title || consultationFee === undefined || consultationFee === '') {
      return res.status(400).json({
        success: false,
        message: 'Name, email, title, and consultation fee are required fields',
      });
    }

    // Check for existing psychologist record with this email
    const existingPsychologist = await Psychologist.findOne({ email: email.toLowerCase() });
    if (existingPsychologist) {
      return res.status(400).json({
        success: false,
        message: 'A psychologist record with this email already exists',
      });
    }

    const parsedSpecialties = Array.isArray(specialties)
      ? specialties
      : typeof specialties === 'string'
      ? specialties.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const parsedLanguages = Array.isArray(languages)
      ? languages
      : typeof languages === 'string'
      ? languages.split(',').map((l) => l.trim()).filter(Boolean)
      : [];

    // Generate 32-byte hex crypto token for magic link invitation
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const userAccount = await User.findOne({ email: email.toLowerCase() });

    const psychologist = await Psychologist.create({
      name,
      email: email.toLowerCase(),
      phone: phone || '',
      title: title || 'Clinical Psychologist',
      specialties: parsedSpecialties,
      qualifications: qualifications || '',
      experienceYears: Number(experienceYears) || 0,
      consultationFee: Number(consultationFee) || 0,
      currency: currency || 'INR',
      bio: bio || '',
      image: image || '/therapist.png',
      languages: parsedLanguages,
      status: status || 'approved',
      inviteToken: rawToken,
      inviteTokenExpires: expiresAt,
      user: userAccount ? userAccount._id : null,
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const inviteUrl = `${clientUrl}/set-password?token=${rawToken}`;

    // Send automated Therapist Activation Email via Nodemailer
    const emailResult = await sendTherapistInviteEmail({
      toEmail: psychologist.email,
      practitionerName: psychologist.name,
      inviteUrl,
    });

    res.status(201).json({
      success: true,
      message: `Psychologist added ${emailResult.sent ? 'and invitation email sent' : 'successfully'}.`,
      inviteUrl,
      emailResult,
      token: rawToken,
      psychologist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update psychologist details (Admin or Therapist) & sync with User table
 * @route   PUT /api/psychologists/:id
 * @access  Private (Admin or Therapist)
 */
export const updatePsychologist = async (req, res, next) => {
  try {
    const { id } = req.params;

    const psychologist = await Psychologist.findById(id);
    if (!psychologist) {
      return res.status(404).json({
        success: false,
        message: 'Psychologist profile not found',
      });
    }

    const {
      name,
      email,
      phone,
      title,
      specialties,
      qualifications,
      experienceYears,
      consultationFee,
      currency,
      bio,
      image,
      languages,
      status,
    } = req.body;

    if (name) psychologist.name = name;
    if (email) psychologist.email = email.toLowerCase();
    if (phone !== undefined) psychologist.phone = phone;
    if (title) psychologist.title = title;

    if (specialties !== undefined) {
      psychologist.specialties = Array.isArray(specialties)
        ? specialties
        : typeof specialties === 'string'
        ? specialties.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    }

    if (qualifications !== undefined) psychologist.qualifications = qualifications;
    if (experienceYears !== undefined) psychologist.experienceYears = Number(experienceYears) || 0;
    if (consultationFee !== undefined) psychologist.consultationFee = Number(consultationFee) || 0;
    if (currency !== undefined) psychologist.currency = currency;
    if (bio !== undefined) psychologist.bio = bio;
    if (image !== undefined) psychologist.image = image;

    if (status !== undefined) psychologist.status = status;

    await psychologist.save();

    // Sync with User table if linked
    if (psychologist.user) {
      const userAccount = await User.findById(psychologist.user);
      if (userAccount) {
        if (name) userAccount.name = name;
        if (email) userAccount.email = email.toLowerCase();
        if (status === 'active' || status === 'inactive') {
          userAccount.status = status;
        }
        await userAccount.save();
      }
    } else {
      const userAccount = await User.findOne({ email: psychologist.email });
      if (userAccount) {
        psychologist.user = userAccount._id;
        await psychologist.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Psychologist updated successfully',
      psychologist,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove / Delete a psychologist & linked User account
 * @route   DELETE /api/psychologists/:id
 * @access  Private/Admin
 */
export const deletePsychologist = async (req, res, next) => {
  try {
    const { id } = req.params;

    const psychologist = await Psychologist.findById(id);
    if (!psychologist) {
      return res.status(404).json({
        success: false,
        message: 'Psychologist profile not found',
      });
    }

    if (psychologist.user) {
      const linkedUser = await User.findById(psychologist.user);
      if (linkedUser && linkedUser.role === 'therapist') {
        await User.findByIdAndDelete(psychologist.user);
      }
    } else {
      await User.findOneAndDelete({ email: psychologist.email.toLowerCase(), role: 'therapist' });
    }

    await Psychologist.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Psychologist ${psychologist.name} and linked User account removed successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get therapist's own psychologist profile
 * @route   GET /api/psychologists/me
 * @access  Private/Therapist
 */
export const getMyPsychologistProfile = async (req, res, next) => {
  try {
    let psychologist = await Psychologist.findOne({ user: req.user.id });

    if (!psychologist) {
      psychologist = await Psychologist.findOne({ email: req.user.email });
    }

    if (!psychologist) {
      return res.status(404).json({
        success: false,
        message: 'Psychologist profile not found for this user',
      });
    }

    res.status(200).json({
      success: true,
      psychologist,
    });
  } catch (error) {
    next(error);
  }
};
