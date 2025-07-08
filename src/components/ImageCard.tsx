import React from 'react';

interface ImageCardProps {
  imageUrl: string;
  title: string;
  category: string;
  price?: string;
  className?: string;
}

const ImageCard: React.FC<ImageCardProps> = ({
  imageUrl,
  title,
  category,
  price,
  className = ''
}) => {
  return (
    <div className={`image-card ${className}`}>
      <article>
        <figure>
          <img src={imageUrl} alt={title} />
          <figcaption>
            <span className="category">{category}</span>
            <h1>{title}</h1>
            {price && <span className="price">{price}</span>}
          </figcaption>
        </figure>
      </article>
    </div>
  );
};

export default ImageCard;