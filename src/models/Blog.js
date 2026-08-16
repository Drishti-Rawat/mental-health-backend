import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Blog title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Summary cannot exceed 500 characters'],
    },
    content: {
      type: String,
      required: [true, 'Blog content is required'],
    },
    coverImage: {
      type: String,
      default: '/blog-placeholder.png',
    },
    author: {
      type: String,
      default: 'MentalCare Editorial Team',
      trim: true,
    },
    category: {
      type: String,
      enum: {
        values: ['Mental Health', 'Therapy', 'Self Care', 'Mindfulness', 'Psychology', 'Wellness', 'General'],
        message: '{VALUE} is not a valid blog category',
      },
      default: 'Mental Health',
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: {
        values: ['published', 'draft', 'archived'],
        message: '{VALUE} is not a valid blog status',
      },
      default: 'published',
    },
    readTime: {
      type: Number,
      default: 5,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Helper method to auto-generate slug from title
blogSchema.statics.createSlug = function (title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const Blog = mongoose.model('Blog', blogSchema);

export default Blog;
